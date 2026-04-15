/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/
import assert from 'assert/strict';
import { EventEmitter } from 'events';
import PathProxy from 'zrender/lib/core/PathProxy.js';

import TerminalCellBuffer from '../../src/TerminalCellBuffer.ts';
import createTerminalInteractionController from '../../src/TerminalInteraction.ts';
import TerminalPainter from '../../src/TerminalPainter.ts';
import createTerminalPlayer from '../../src/TerminalPlayer.ts';
import { TerminalRenderer, initTerminalChart, patchECharts, renderToTerminalString } from '../../src/index.ts';
import { normalizeTerminalChartOption } from '../../src/normalizeTerminalChartOption.ts';
import { ANSI_RESET, resolveTerminalColor, toAnsiBackground, toAnsiForeground } from '../../src/terminalColor.ts';
import { paintPath } from '../../src/terminalPath.ts';

function makePainter() {
    return new TerminalPainter(null, {
        getDisplayList() {
            return [];
        }
    }, { width: 16, height: 8, terminalWidth: 16, terminalHeight: 8 });
}

// TerminalCellBuffer branches
{
    const buffer = new TerminalCellBuffer(1, 1);
    buffer.drawText(0, 0, '', [255, 255, 255]);
    buffer.drawText(0, 5, 'Z', [255, 255, 255]);
    buffer.drawText(0, 0, 'A', [255, 255, 255]);
    buffer.drawText(0, 0, 'B', [255, 255, 255]);
    const output = buffer.toString();
    assert.ok(output.includes('B'));

    const fullCellBuffer = new TerminalCellBuffer(1, 1);
    fullCellBuffer.setPixel(0, 0, [1, 2, 3]);
    fullCellBuffer.setPixel(0, 1, [1, 2, 3]);
    assert.equal(
        fullCellBuffer.toString(),
        `${ANSI_RESET}${toAnsiBackground([1, 2, 3])} ${ANSI_RESET}`,
        'fully filled cells should use background-colored spaces instead of block glyphs'
    );
}

// terminalColor branches
assert.equal(resolveTerminalColor(null), null);
assert.deepEqual(resolveTerminalColor('#000000', { minLuminance: 12 }), [12, 12, 12]);
assert.equal(resolveTerminalColor('rgba(0,0,0,0)', { opacity: 1 }), null);
assert.deepEqual(resolveTerminalColor('#ffffff', { minLuminance: 12 }), [255, 255, 255]);
assert.deepEqual(
    resolveTerminalColor({ colorStops: [{ color: '#ff0000' }, { color: '#00ff00' }] }, { opacity: 1 }),
    [128, 128, 0]
);
assert.equal(resolveTerminalColor({ colorStops: [{ color: 'rgba(0,0,0,0)' }] }, { opacity: 1 }), null);
assert.equal(resolveTerminalColor({ foo: 'bar' }), null);
assert.equal(toAnsiForeground([1, 2, 3]), '\u001b[38;2;1;2;3m');
assert.equal(toAnsiBackground([4, 5, 6]), '\u001b[48;2;4;5;6m');
assert.equal(ANSI_RESET, '\u001b[0m');

// terminalPath quadratic and rect branches
{
    const quadProxy = new PathProxy();
    quadProxy.moveTo(0, 0);
    quadProxy.quadraticCurveTo(2, 4, 4, 0);
    const quadEl = {
        getUpdatedPathProxy() {
            return quadProxy;
        },
        getComputedTransform() {
            return null;
        }
    };
    const quadBuffer = new TerminalCellBuffer(8, 4);
    paintPath(quadBuffer, quadEl, null, [255, 255, 255], 1, 1);
    assert.notEqual(quadBuffer.toString(), `${' '.repeat(8)}${ANSI_RESET}\n${' '.repeat(8)}${ANSI_RESET}\n${' '.repeat(8)}${ANSI_RESET}\n${' '.repeat(8)}${ANSI_RESET}`);
    paintPath(new TerminalCellBuffer(8, 4), quadEl, [255, 255, 255], null, 1, 1);

    const rectProxy = new PathProxy();
    rectProxy.rect(0, 0, 4, 2);
    const rectEl = {
        getUpdatedPathProxy() {
            return rectProxy;
        },
        getComputedTransform() {
            return null;
        }
    };
    const rectBuffer = new TerminalCellBuffer(8, 4);
    paintPath(rectBuffer, rectEl, null, [255, 255, 255], 1, 1);
    assert.ok(rectBuffer.toString().includes('█') || rectBuffer.toString().includes('▀') || rectBuffer.toString().includes('▄'));
    paintPath(new TerminalCellBuffer(8, 4), rectEl, [255, 255, 255], null, 1, 1);

    const cubicProxy = new PathProxy();
    cubicProxy.moveTo(0, 0);
    cubicProxy.bezierCurveTo(1, 4, 3, 4, 4, 0);
    const cubicEl = {
        getUpdatedPathProxy() {
            return cubicProxy;
        },
        getComputedTransform() {
            return null;
        }
    };
    const cubicBuffer = new TerminalCellBuffer(8, 4);
    paintPath(cubicBuffer, cubicEl, null, [255, 255, 255], 1, 1);
    assert.ok(cubicBuffer.toString().includes('█') || cubicBuffer.toString().includes('▀') || cubicBuffer.toString().includes('▄'));

    const arcProxy = new PathProxy();
    arcProxy.moveTo(2, 0);
    arcProxy.arc(2, 2, 2, -Math.PI / 2, Math.PI / 2, false);
    const arcEl = {
        getUpdatedPathProxy() {
            return arcProxy;
        },
        getComputedTransform() {
            return null;
        }
    };
    const arcBuffer = new TerminalCellBuffer(8, 6);
    paintPath(arcBuffer, arcEl, null, [255, 255, 255], 1, 1);
    assert.ok(arcBuffer.toString().includes('█') || arcBuffer.toString().includes('▀') || arcBuffer.toString().includes('▄'));
}

// normalizeTerminalChartOption branches
{
    const singleSeries = normalizeTerminalChartOption({
        series: { type: 'pie', data: [{ name: 'Alpha', value: { value: 7 } }] }
    });
    assert.equal(typeof singleSeries.series.label.formatter, 'function');
    assert.equal(singleSeries.series.label.formatter({ name: 'Alpha', value: { value: 7 } }), 'Alpha:7');

    const mixedSeries = normalizeTerminalChartOption({
        series: [5]
    });
    assert.deepEqual(mixedSeries.series, [5]);
    assert.equal(normalizeTerminalChartOption({ series: 'noop' }).series, 'noop');

    const legendNormalized = normalizeTerminalChartOption({
        legend: {
            data: ['Alpha', 'Beta']
        },
        series: [
            { name: 'Alpha', type: 'bar', itemStyle: { color: '#112233' }, data: [1, 2] },
            { name: 'Beta', type: 'line', lineStyle: { color: '#445566' }, data: [3, 4] }
        ]
    });
    assert.deepEqual(legendNormalized.legend.data, [
        { name: 'Alpha', itemStyle: { color: '#112233', opacity: 1 } },
        { name: 'Beta', itemStyle: { color: '#445566', opacity: 1 } }
    ]);
}

// index.ts branches
assert.equal(patchECharts(null), null);
assert.equal(patchECharts('noop'), 'noop');
{
    let installed;
    TerminalRenderer.install({
        registerPainter(type, painter) {
            installed = { type, painter };
        }
    });
    assert.equal(installed.type, 'terminal');
}
{
    let initOptions;
    const source = {
        foo: 'bar',
        init(dom, theme, opts) {
            initOptions = opts;
            return {
                getZr() {
                    return { painter: { type: 'svg', renderToString() { return 'x'; } } };
                }
            };
        }
    };
    const patched = patchECharts(source);
    assert.equal(patched.foo, 'bar');
    patched.init(null, null, {});
    assert.deepEqual(initOptions, {});
}
{
    let initOptions;
    let resizeOptions;
    const chart = {
        getZr() {
            return { painter: { type: 'terminal', _opts: {}, renderToString() { return 'x'; } } };
        },
        resize(opts) {
            resizeOptions = opts;
        }
    };
    const echartsImpl = {
        init(dom, theme, opts) {
            initOptions = opts;
            return chart;
        }
    };
    const patched = patchECharts(echartsImpl);
    const terminalChart = patched.init(null, null, { renderer: 'terminal', width: '10', height: '5' });
    terminalChart.resize({ width: 'auto', terminalWidth: '12', height: 'auto', terminalHeight: '6' });
    assert.equal(initOptions.width, 80);
    assert.equal(initOptions.height, 80);
    assert.equal(resizeOptions.width, 96);
    assert.equal(resizeOptions.height, 96);
}
{
    let initCalled = false;
    const chart = initTerminalChart({
        init(dom, theme, opts) {
            initCalled = true;
            assert.equal(opts.renderer, 'terminal');
            return {
                getZr() {
                    return { painter: { type: 'terminal', _opts: opts, renderToString() { return 'ok'; } } };
                }
            };
        }
    }, null, { width: 20, height: 10 });
    assert.equal(initCalled, true);
    assert.equal(renderToTerminalString(chart), 'ok');
}
{
    let resizeOptions;
    const chart = {
        getZr() {
            return { painter: { type: 'svg', _opts: {}, renderToString() { return 'x'; } } };
        },
        resize(opts) {
            resizeOptions = opts;
        }
    };
    const patched = patchECharts({
        init() {
            return chart;
        }
    });
    const svgChart = patched.init(null, null, {});
    svgChart.resize({ width: 3 });
    assert.deepEqual(resizeOptions, { width: 3 });
}
assert.throws(
    () => renderToTerminalString({
        getZr() {
            return { painter: { type: 'svg', renderToString() { return ''; } } };
        }
    }),
    /terminal renderer/
);

// TerminalPlayer branches
{
    let resizeCalls = 0;
    let disposeCalls = 0;
    let rendered = 0;
    const chart = {
        getModel() { return null; },
        getOption() { return {}; },
        getZr() {
            return {
                painter: {
                    type: 'terminal',
                    setInteractionState() {}
                }
            };
        },
        renderToTerminalString() {
            rendered++;
            return 'frame';
        },
        setOption() {
            return 'set';
        },
        resize() {
            resizeCalls++;
            return 'resize';
        },
        dispose() {
            disposeCalls++;
            return 'dispose';
        }
    };
    const output = [];
    const player = createTerminalPlayer(chart, {
        output: { write(chunk) { output.push(chunk); } },
        interactive: false
    });
    assert.equal(player.isActive(), true);
    chart.resize();
    chart.dispose();
    assert.ok(rendered >= 1);
    assert.equal(resizeCalls, 1);
    assert.equal(disposeCalls, 1);
    player.clear();
    player.stop();
    player.stop();
}
{
    const originalProcess = globalThis.process;
    const fakeStdoutChunks = [];
    let stdinOnCalls = 0;
    globalThis.process = {
        stdout: { write(chunk) { fakeStdoutChunks.push(chunk); } },
        stdin: { isTTY: false, on() { stdinOnCalls++; }, off() {}, resume() {}, pause() {} }
    };
    const chart = {
        getModel() { return null; },
        getOption() { return {}; },
        getZr() { return { painter: { type: 'terminal', setInteractionState() {} } }; },
        renderToTerminalString() { return 'frame'; }
    };
    const player = createTerminalPlayer(chart, {});
    assert.equal(player.isActive(), true);
    player.render();
    player.clear();
    player.stop();
    player.stop();
    assert.ok(stdinOnCalls >= 1);
    globalThis.process = originalProcess;
}
{
    const chart = {
        getModel() { return null; },
        getOption() { return {}; },
        getZr() { return { painter: { type: 'terminal', setInteractionState() {} } }; },
        renderToTerminalString() { return 'frame'; }
    };
    const player = createTerminalPlayer(chart, {
        output: null,
        autoRender: false,
        clearOnStop: false,
        interactive: false
    });
    player.render();
    player.clear();
    player.stop();
    player.stop();
}

// TerminalInteraction branches
assert.equal(createTerminalInteractionController({
    chart: {},
    input: null,
    onUpdate() {}
}), null);

{
    class FakeInput extends EventEmitter {
        isTTY = true;
        rawMode = false;
        setRawMode(value) { this.rawMode = value; }
        resume() {}
        pause() {}
        send(value) { this.emit('data', typeof value === 'string' ? value : new Uint8Array(value)); }
    }
    const input = new FakeInput();
    let updates = 0;
    const chart = {
        getOption() {
            return {
                xAxis: { data: ['A', 'B'] },
                series: [
                    { name: 'Alpha', lineStyle: { color: '#112233' }, data: [1, 2] },
                    { name: 'Beta', lineStyle: { color: '#445566' }, data: [3, 4] }
                ]
            };
        },
        getModel() {
            return {
                eachSeries(cb) {
                    [
                        { subType: 'line', componentIndex: 0, name: 'Alpha', getData() { return fakeDataAlpha; } },
                        { subType: 'line', componentIndex: 1, name: 'Beta', getData() { return fakeDataBeta; } },
                        { subType: 'pie', componentIndex: 2, name: 'Skip', getData() { return { count() { return 0; } }; } }
                    ].forEach(cb);
                }
            };
        }
    };
    const fakeDataAlpha = {
        count() { return 2; },
        getItemGraphicEl(index) {
            const rects = [
                { x: 10, y: 20, width: 4, height: 4 },
                { x: 30, y: 40, width: 4, height: 4 }
            ];
            const rect = rects[index];
            return {
                getBoundingRect() { return { clone() { return { ...rect, applyTransform() {} }; } }; },
                getComputedTransform() { return null; }
            };
        }
    };
    const fakeDataBeta = {
        count() { return 2; },
        getItemGraphicEl(index) {
            const rects = [
                { x: 15, y: 25, width: 4, height: 4 },
                { x: 35, y: 45, width: 4, height: 4 }
            ];
            const rect = rects[index];
            return {
                getBoundingRect() { return { clone() { return { ...rect, applyTransform() {} }; } }; },
                getComputedTransform() { return null; }
            };
        }
    };

    const controller = createTerminalInteractionController({
        chart,
        input,
        onUpdate() { updates++; }
    });
    assert.equal(controller.isActive(), false);

    const states = [];
    controller.prepareFrame({ setInteractionState(state) { states.push(state); } });
    assert.equal(states.at(-1), null);

    input.send('\n');
    assert.equal(controller.isActive(), true);
    input.send('\u001b[A');
    input.send('\u001b[D');
    input.send('\u001b[B');
    input.send('\u001b[C');
    controller.prepareFrame({ setInteractionState(state) { states.push(state); } });
    assert.equal(states.at(-1).kind, 'point');
    assert.ok(states.at(-1).infoText.includes('INTERACTIVE'));
    input.send('\u001b');
    assert.equal(controller.isActive(), false);
    controller.stop();
    controller.stop();
    assert.ok(updates >= 4);
}
{
    class FakeInput extends EventEmitter {
        isTTY = false;
        setRawMode() {}
        resume() {}
        pause() {}
        send(value) { this.emit('data', value); }
    }
    const input = new FakeInput();
    let updates = 0;
    const controller = createTerminalInteractionController({
        chart: {
            getOption() {
                return { series: [{ name: 'S', data: [5, 6] }] };
            },
            getModel() {
                return {
                    eachSeries(cb) {
                        cb({
                            subType: 'scatter',
                            componentIndex: 0,
                            name: 'S',
                            getData() {
                                return {
                                    count() { return 2; },
                                    getItemGraphicEl(index) {
                                        if (index === 0) {
                                            return {};
                                        }
                                        return {
                                            getBoundingRect() { return { clone() { return { x: 1, y: 2, width: 2, height: 2, applyTransform() {} }; } }; },
                                            getComputedTransform() { return null; }
                                        };
                                    }
                                };
                            }
                        });
                    }
                };
            }
        },
        input,
        onUpdate() { updates++; }
    });
    const states = [];
    input.send('\n');
    controller.prepareFrame({ setInteractionState(state) { states.push(state); } });
    assert.ok(states.at(-1).infoText.includes('1:6'));
    input.send('\u001b[D');
    input.send('\u001b[A');
    controller.stop();
    assert.ok(updates >= 1);
}
{
    class FakeInput extends EventEmitter {
        isTTY = false;
        setRawMode() {}
        resume() {}
        pause() {}
        send(value) { this.emit('data', value); }
    }
    const input = new FakeInput();
    const controller = createTerminalInteractionController({
        chart: {
            getOption() {
                return { xAxis: { data: ['P'] }, series: [{ name: 'ScatterArray', data: [[1.2, 3.4]] }] };
            },
            getModel() {
                return {
                    eachSeries(cb) {
                        cb({
                            subType: 'scatter',
                            componentIndex: 0,
                            name: 'ScatterArray',
                            getData() {
                                return {
                                    count() { return 1; },
                                    getItemGraphicEl() {
                                        return {
                                            getBoundingRect() { return { clone() { return { x: 1, y: 1, width: 2, height: 2, applyTransform() {} }; } }; },
                                            getComputedTransform() { return null; }
                                        };
                                    }
                                };
                            }
                        });
                    }
                };
            }
        },
        input,
        onUpdate() {}
    });
    const states = [];
    input.send('\n');
    controller.prepareFrame({ setInteractionState(state) { states.push(state); } });
    assert.ok(states.at(-1).infoText.includes('1.2,3.4'));
    controller.stop();
}
{
    class FakeInput extends EventEmitter {
        isTTY = false;
        setRawMode() {}
        resume() {}
        pause() {}
        send(value) { this.emit('data', value); }
    }
    const input = new FakeInput();
    const controller = createTerminalInteractionController({
        chart: {
            getOption() {
                return { xAxis: { data: ['P'] }, series: [{ name: 'ScatterArray', data: [[1.2, 3.4]] }] };
            },
            getModel() {
                return {
                    eachSeries(cb) {
                        cb({
                            subType: 'scatter',
                            componentIndex: 0,
                            name: 'ScatterArray',
                            getData() {
                                return {
                                    count() { return 1; },
                                    getItemGraphicEl() {
                                        return {
                                            getBoundingRect() { return { clone() { return { x: 1, y: 1, width: 2, height: 2, applyTransform() {} }; } }; },
                                            getComputedTransform() { return null; }
                                        };
                                    }
                                };
                            }
                        });
                    }
                };
            }
        },
        input,
        onUpdate() {}
    });
    const states = [];
    input.send('\n');
    controller.prepareFrame({ setInteractionState(state) { states.push(state); } });
    assert.ok(states.at(-1).infoText.includes('1.2,3.4'));
    controller.stop();
}
{
    class FakeInput extends EventEmitter {
        isTTY = false;
        setRawMode() {}
        resume() {}
        pause() {}
        send(value) { this.emit('data', value); }
    }
    const input = new FakeInput();
    const controller = createTerminalInteractionController({
        chart: {
            getOption() {
                return { series: [{ name: 'ScatterOnly', data: [5] }] };
            },
            getModel() {
                return {
                    eachSeries(cb) {
                        cb({
                            subType: 'scatter',
                            componentIndex: 0,
                            name: 'ScatterOnly',
                            getData() {
                                return {
                                    count() { return 1; },
                                    getItemGraphicEl() {
                                        return {
                                            getBoundingRect() { return { clone() { return { x: 1, y: 1, width: 2, height: 2, applyTransform() {} }; } }; },
                                            getComputedTransform() { return null; }
                                        };
                                    }
                                };
                            }
                        });
                    }
                };
            }
        },
        input,
        onUpdate() {}
    });
    const states = [];
    input.send('\n');
    controller.prepareFrame({ setInteractionState(state) { states.push(state); } });
    assert.ok(states.at(-1).infoText.includes('0:5'));
    controller.stop();
}

// TerminalPainter branches
{
    const painter = makePainter();
    const buffer = new TerminalCellBuffer(8, 4);
    assert.equal(painter.getType(), 'terminal');
    assert.equal(painter.getViewportRoot(), undefined);
    assert.deepEqual(painter.getViewportRootOffset(), { offsetLeft: 0, offsetTop: 0 });
    painter.refresh();
    assert.equal(painter.getLastRenderResult().split('\n').length, 8);
    assert.equal(painter.getWidth(), 16);
    assert.equal(painter.getHeight(), 8);
    painter.refreshHover();
    painter.configLayer();
    painter.setBackgroundColor();
    painter._paintTinyMarker(buffer, {}, null, 1, 1);
    painter._paintInteractionPoint(buffer, 1, 1);
    painter.setInteractionState({ active: true, infoText: 'x', kind: 'bar', x: 1, y: 1, color: [255, 255, 255] });
    painter._paintInteractionBar(buffer, 1, 1);
    painter.setInteractionState(null);
    painter._paintInteractionOverlay(buffer, 1, 1);
    const duplicatePath = {
        silent: true,
        style: { fill: '#ffffff', opacity: 1 },
        getBoundingRect() { return { clone() { return { x: 0, y: 0, width: 1, height: 1, applyTransform() {} }; } }; },
        getComputedTransform() { return null; },
        getUpdatedPathProxy() { return {}; },
        buildPath() {}
    };
    painter._interactiveTinyMarkers = new Set([painter._getTinyMarkerKey(duplicatePath, 1, 1)]);
    painter._paintDisplayable(buffer, duplicatePath, 1, 1);
    assert.equal(painter._isPathLike({ getUpdatedPathProxy() {}, buildPath() {} }), true);
    painter._paintDisplayable(buffer, {
        style: { text: '' },
        getBoundingRect() { return { clone() { return { x: 0, y: 0, width: 0, height: 0, applyTransform() {} }; } }; },
        type: 'text'
    }, 1, 1);
    painter.dispose();
}

console.log(JSON.stringify({ ok: true }));
