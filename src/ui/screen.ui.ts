/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { ServerEventsType } from '@server/interfaces/server.interface';
import type { LogLevelType } from '@providers/interfaces/log-provider.interface';
import type { LifecycleEventsType, LifecycleLogsType } from '@interfaces/lifecycle.interface';

/**
 * Imports
 */

import { exit } from 'process';
import { setActivity } from '@ui/interactive.ui';
import { Injectable, inject } from '@remotex-labs/xinject';
import { ConfigurationService } from '@services/configuration.service';
import { TypescriptService } from '@typescript/services/typescript.service';
import { clearScreen, createActionPrefix, printGroup, printOutputs } from '@ui/print.ui';
import { keywordColor, mutedColor, warnColor, errorColor, infoColor, okColor, pathColor } from '@ui/color.ui';
import { WarningSymbol, ErrorSymbol, DotSymbol, ArrowSymbol, ReloadSymbol, SuccessSymbol, Levels } from '@constants/ui.constant';

/**
 * Turns what a run reports into what a terminal shows.
 *
 * @remarks
 * Every event of a run arrives here: a build starting and ending, a server answering, a check reporting.
 * Each one becomes a printed line, the groups of messages under it, and a word on the status line,
 * so the scrollback carries the whole run while the bar carries only what is happening now.
 * A singleton, since a run has one terminal and the level it reports at is read from every corner of it.
 *
 * @example
 * ```ts
 * const screen = inject(Screen, () => build.build());
 * build.subscribe(screen.buildEvent.bind(screen));
 *
 * screen.toggleVerbose(); // 'verbose' - and the bar says so
 * ```
 *
 * @see LifecycleEventsType
 * @since 3.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class Screen {
    /**
     * The configuration service the reporting level is read and written through.
     *
     * @remarks
     * The injected instance rather than one of its own,
     * so a level a key changes here is the level every other reader of the configuration sees.
     *
     * @example
     * ```ts
     * screen.config$.getValue().logLevel; // 'info'
     * ```
     *
     * @see ConfigurationService
     * @since 3.0.0
     */

    readonly config$ = inject(ConfigurationService);

    /**
     * The address a running server answers on, absent while none is running.
     *
     * @remarks
     * Written as the server reports its start and cleared as it stops,
     * so the status line offers a URL only while there is one to open.
     *
     * @since 3.0.0
     */

    private serverUrl?: string;

    /**
     * The level to go back to once reporting is turned down again.
     *
     * @remarks
     * Held so that turning `verbose` off restores the level the run was started at rather than a default,
     * which is what makes the toggle reversible for a run started at `error`.
     *
     * @since 3.0.0
     */

    private restoreLevel: LogLevelType;

    /**
     * Takes the build a key or a watch asks for, and settles the level to fall back to.
     *
     * @param build - What to run when a rebuild is asked for
     *
     * @remarks
     * The build arrives as a callback rather than as a service,
     * so the screen starts a run without knowing what a run is made of.
     * A run already started at `verbose` has no quieter level to remember, so `info` stands in as the one to return to.
     *
     * @example
     * ```ts
     * const screen = inject(Screen, runBuild); // runBuild is what a key or a watch will call
     * ```
     *
     * @since 3.0.0
     */

    constructor(private readonly build: () => Promise<void>) {
        this.restoreLevel = this.logLevel !== 'verbose' ? this.logLevel : 'info';
    }

    /**
     * Sets the level the run reports at.
     *
     * @param value - Level to report at from now on
     *
     * @remarks
     * Written through the configuration rather than held here,
     * so a variant reading the level for its own messages and the screen reading it for its groups agree.
     *
     * @example
     * ```ts
     * screen.logLevel = 'warning'; // info and verbose stop printing
     * ```
     *
     * @see LogLevelType
     * @since 3.0.0
     */

    set logLevel(value: LogLevelType) {
        this.config$.patch({ logLevel: value });
    }

    /**
     * The level the run is reporting at.
     *
     * @returns The configured level, `info` where the configuration names none
     *
     * @example
     * ```ts
     * screen.logLevel; // 'info'
     * ```
     *
     * @see LogLevelType
     * @since 3.0.0
     */

    get logLevel(): LogLevelType {
        return this.config$.getValue().logLevel ?? 'info';
    }

    /**
     * The address the running server answers on.
     *
     * @returns The URL, empty while no server is running
     *
     * @remarks
     * Empty rather than absent, so a caller writing it into a line needs no guard of its own.
     *
     * @example
     * ```ts
     * screen.url; // 'http://localhost:3000'
     * ```
     *
     * @since 3.0.0
     */

    get url(): string {
        return this.serverUrl ?? '';
    }

    /**
     * Records the address a server has begun answering on.
     *
     * @param value - URL the server bound to
     *
     * @example
     * ```ts
     * screen.url = 'http://localhost:3000';
     * ```
     *
     * @since 3.0.0
     */

    set url(value: string) {
        this.serverUrl = value;
    }

    /**
     * Reports either end of a build: its start or its finish.
     *
     * @param event - What the variant reported, carrying its context and, at the end, its result
     *
     * @remarks
     * A start says which variant is building and no more, since nothing has been found out yet.
     * An end prints the messages first and the outcome last,
     * so a reader scrolling up meets the verdict before its reasons.
     * A build that wrote no output is the failing case, whether it threw or only reported errors,
     * and it sets the exit code, which is what lets a pipeline read the run without reading its output.
     * Reporting at `verbose` lists every output rather than the largest few.
     *
     * @example
     * ```ts
     * build.subscribe(screen.buildEvent.bind(screen));
     * // [xBuild] → build esm
     * // [xBuild] ✓ esm in 128 ms
     * ```
     *
     * @see LifecycleEventsType
     * @since 3.0.0
     */

    buildEvent(event: LifecycleEventsType): void {
        if (event.type === 'start')
            return this.say(`${ infoColor.dim(ArrowSymbol) } ${ mutedColor('building') } ${ keywordColor(event.context.variantName) }`,
                `${ createActionPrefix('build') } ${ keywordColor(event.context.variantName) }`);

        const { errors, warnings, info, verbose: notes, metafile } = event.buildResult;
        const failed = !metafile;
        if (failed) process.exitCode = 1;
        else process.exitCode = 0;

        this.groups({ error: errors, warning: warnings, info, verbose: notes });
        if (metafile) printOutputs(metafile, this.logLevel === 'verbose' ? Infinity : undefined);

        const symbol = failed ? errorColor(ErrorSymbol) : okColor(SuccessSymbol);
        const name = failed ? warnColor(event.context.variantName) : keywordColor(event.context.variantName);

        this.say(`${ symbol } ${ name } ${ mutedColor.dim(`in ${ event.duration } ms`) }`,
            `\n${ createActionPrefix('build', symbol) } ${ name } ${ mutedColor.dim(`in ${ event.duration } ms`) }`);
    }

    /**
     * Reports what the development server is doing.
     *
     * @param event - What the server reported: its start, its stop, a request, or a failure
     *
     * @remarks
     * A start is where the address comes from, and a stop is what takes it away again,
     * so the status line offers the URL for exactly as long as something answers on it.
     * A stop is reported only where a server was running, since a stop is worth a line only where something was answering.
     * Requests are reported only at `verbose`, one line being worth little against a page that fetches thirty files.
     * A failed `favicon.ico` is dropped whatever the level, since browsers ask for one unprompted on every visit.
     *
     * @example
     * ```ts
     * server.subscribe(screen.serverEvent.bind(screen));
     * // [xBuild] → serve http://localhost:3000
     * ```
     *
     * @see ServerEventsType
     * @since 3.0.0
     */

    serverEvent(event: ServerEventsType): void {
        switch (event.type) {
            case 'start':
                this.url = event.url;

                return console.log(`${ createActionPrefix('serve') } ${ pathColor(event.url) }`);
            case 'stop':
                this.serverUrl = undefined;
                if (event.running) console.log(`${ createActionPrefix('serve') } ${ mutedColor('stopped') }`);

                return;
            case 'request':
                if (this.logLevel === 'verbose')
                    console.log(`${ createActionPrefix('serve') } ${ mutedColor.dim(event.url) }`);

                return;
            case 'error':
                if (event.url?.includes('favicon')) return;
                console.log(
                    `${ createActionPrefix('serve', errorColor(ErrorSymbol)) } ${ mutedColor(event.error.message) }`
                );
        }
    }

    /**
     * Reports a type check and ends the process on what it found.
     *
     * @param diagnostics - Messages each variant's check reported, keyed by the variant's name
     *
     * @remarks
     * Every variant gets a heading carrying what it found, followed by its groups,
     * so a clean variant is still reported rather than left out of a run that named it.
     * The count is of everything the check reported rather than of what the level prints,
     * which is what keeps a quiet run from reading as a clean one.
     * The process leaves from here, and an error anywhere leaves with `1`,
     * since a check is the whole of what a run asking for one wanted.
     *
     * @example
     * ```ts
     * screen.diagnostics(await build.typeChack());
     * // [xBuild] → type-check esm 2 to look at
     * ```
     *
     * @see LifecycleLogsType
     * @since 3.0.0
     */

    diagnostics(diagnostics: Record<string, LifecycleLogsType>): void {
        let failed = false;

        for (const [ name, logs ] of Object.entries(diagnostics)) {
            const total = logs.error.length + logs.warning.length + logs.info.length + logs.verbose.length;

            failed ||= logs.error.length > 0;
            console.log(`${ createActionPrefix('type-check') } ${ keywordColor(name) } ${ mutedColor.dim(`${ total } to look at`) }`);
            this.groups(logs);
            console.log('');
        }

        exit(failed ? 1 : 0);
    }

    /**
     * Clears what the last build left, takes up any configuration change, says what asked for this build, and runs it.
     *
     * @param reason - What asked for the build, such as the files that changed or the key that was pressed
     * @param force - Whether every TypeScript project reparses its configuration even where its file has not moved
     *
     * @remarks
     * Every rebuild of a watch goes through here, so the screen is cleared and the run announced the same way
     * whichever asked for it.
     * The build itself is the one the run handed over when the screen was made.
     * The TypeScript configurations are reloaded here rather than by the watch,
     * so a rebuild started by a key reads them as freshly as one started by a changed file.
     * A configuration that has stayed put costs a lookup and nothing more.
     * Forcing reparses every project regardless, which is what the reload key asks for
     * and what catches a change the configuration file's own version misses.
     *
     * @example
     * ```ts
     * await screen.rebuild('2 files changed'); // [xBuild] rebuild 2 files changed
     * await screen.rebuild('reloading', true); // the same, with every tsconfig reparsed first
     * ```
     *
     * @see TypescriptService.reload
     * @since 3.0.0
     */

    async rebuild(reason: string, force: boolean = false): Promise<void> {
        clearScreen();
        TypescriptService.reload(force);

        this.say(`${ infoColor.dim(ReloadSymbol) } ${ mutedColor(reason) }`,
            `${ createActionPrefix('rebuild', infoColor.dim(ReloadSymbol)) } ${ mutedColor(reason) }`);

        await this.build();
    }

    /**
     * Turns reporting all the way up, or back to what it was before it was turned up.
     *
     * @returns The level the run now reports at
     *
     * @remarks
     * The level the run was set to is remembered rather than assumed,
     * so a run started at `error` goes back to `error` rather than to the default.
     * The level is written back through the configuration, so everything reading it follows in the same breath.
     *
     * @example
     * ```ts
     * screen.toggleVerbose(); // 'verbose'
     * screen.toggleVerbose(); // 'info' - what it was before
     * ```
     *
     * @since 3.0.0
     */

    toggleVerbose(): LogLevelType {
        if (this.logLevel === 'verbose') this.logLevel = this.restoreLevel;
        else {
            this.restoreLevel = this.logLevel;
            this.logLevel = 'verbose';
        }

        return this.logLevel;
    }

    /**
     * Writes a line to the scrollback and says the same thing on the status line.
     *
     * @param activity - What is happening, as the bar says it
     * @param line - The line printed to the scrollback
     *
     * @remarks
     * The two are worded apart rather than shared, since the bar carries no prefix and has one row to say it in,
     * while the printed line stands on its own long after the run has moved past it.
     *
     * @see setActivity
     * @since 3.0.0
     */

    private say(activity: string, line: string): void {
        console.log(line);
        setActivity(activity);
    }

    /**
     * Prints the message groups the current level allows.
     *
     * @param logs - Messages to print, filed under the level each was reported at
     *
     * @remarks
     * The groups run loudest first, so what failed a build is read before what merely remarked on it.
     * Each group is compared against the level the run is set to,
     * which is what leaves a quiet run its errors and drops everything under them.
     * An error always carries its code window and its trace, since that is what an error is read for,
     * while the quieter groups carry theirs only at `verbose`.
     *
     * @see Levels
     * @see printGroup
     *
     * @since 3.0.0
     */

    private groups(logs: LifecycleLogsType): void {
        const lowest = Levels[this.logLevel];
        const code = this.logLevel === 'verbose';

        if (Levels.error >= lowest) printGroup(logs.error, 'Errors', errorColor, ErrorSymbol, true);
        if (Levels.warning >= lowest) printGroup(logs.warning, 'Warnings', warnColor, WarningSymbol, code);
        if (Levels.info >= lowest) printGroup(logs.info, 'Info', infoColor, ArrowSymbol, code);
        if (Levels.verbose >= lowest) printGroup(logs.verbose, 'Verbose', mutedColor, DotSymbol, code);
    }
}
