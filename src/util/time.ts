// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

export function secondsToMs(s: number): number {
    return s * 1000;
}

export function msToSeconds(s: number): number {
    return s / 1000;
}

export function minutesToMs(m: number): number {
    return secondsToMs(m) * 60;
}

export function hoursToMs(h: number): number {
    return minutesToMs(h) * 60;
}

export function daysToMs(d: number): number {
    return hoursToMs(d) * 24;
}

export function weeksToMs(w: number): number {
    return daysToMs(w) * 7;
}
