// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

import Gio from 'gi://Gio';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');

export const BUS_NAME = 'com.github.wwmm.easyeffects';

// Runs the easyeffects command line client and returns its stdout.
// Only call this while BUS_NAME is owned: otherwise the client
// starts a new Easy Effects instance, window included.
async function run(...args) {
    const proc = Gio.Subprocess.new(['easyeffects', ...args],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
    const [stdout] = await proc.communicate_utf8_async(null, null);
    return stdout ?? '';
}

// Turns lines like "Output Presets: a,b," into {Output: 'a,b,'}.
function parseLines(text) {
    const fields = {};
    for (const line of text.split('\n')) {
        const sep = line.indexOf(':');
        if (sep < 0)
            continue;
        const key = line.slice(0, sep).trim().split(' ')[0];
        fields[key] = line.slice(sep + 1).trim();
    }
    return fields;
}

// Returns {output: [...], input: [...]} with the available preset names.
export async function getPresets() {
    const fields = parseLines(await run('-p'));
    const split = value => (value ?? '').split(',').filter(name => name.length > 0);
    return {output: split(fields.Output), input: split(fields.Input)};
}

// Returns {output, input} with the loaded preset names ('' when none).
export async function getActivePresets() {
    const fields = parseLines(await run('-a'));
    return {output: fields.Output ?? '', input: fields.Input ?? ''};
}

export async function loadPreset(name) {
    await run('-l', name);
}

export async function isBypassed() {
    return (await run('-b', '3')).trim() === '1';
}

export async function setBypassed(bypassed) {
    await run('-b', bypassed ? '1' : '2');
}

// Starts Easy Effects in the background, without its window.
export function startService() {
    Gio.Subprocess.new(['easyeffects', '--gapplication-service'],
        Gio.SubprocessFlags.NONE);
}
