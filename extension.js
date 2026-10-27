// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {PresetIndicator} from './indicator.js';

// The extension: it only adds the indicator to Quick Settings.
export default class PresetChangerExtension extends Extension {
    enable() {
        this._indicator = new PresetIndicator(this.getSettings());
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
