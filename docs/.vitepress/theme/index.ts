/**
 * Import will remove at compile time
 */

import type { Theme } from 'vitepress';
import type { VNode } from '@vue/runtime-core';
import type { Awaitable } from 'vitepress/types/shared';

/**
 * Styles
 */

import './style.css';

/**
 * Imports
 */

import { h } from 'vue';
import DefaultTheme from 'vitepress/theme';
import VersionSwitcher from 'vitepress-versioning-plugin/src/components/VersionSwitcher.vue';

export default {
    extends: DefaultTheme,
    Layout: (): VNode => {
        return h(DefaultTheme.Layout, null, {
        });
    },
    enhanceApp({ app }): Awaitable<void> {
        app.component('VersionSwitcher', VersionSwitcher);
    }
} satisfies Theme;
