import { Fifo, chain } from '@sweepbright/iter-helpers';
import JSONStream from 'JSONStream';
import { fail } from 'assert';
import { createReadStream } from 'fs';
import { encode } from 'pluscodes';
import { Transform } from 'stream';
import { ActivityRecord, LocationWithTime, parseLocation } from './entities';

const TIME_SPAN_DURATION = 24 * 60 * 60 * 1000;

function createObjectsStreamer() {
    return createReadStream('./data/Records.json', {
        encoding: 'utf8',
    })
        .pipe(JSONStream.parse('locations.*'))
        .pipe(
            new Transform({
                objectMode: true,
                transform: (d, _, cb) => cb(null, d),
                highWaterMark: 1000,
            })
        );
}

interface TimeSpanStatItem {
    prevTimeSpan: number;
    timeSpan: number;
    size: number;
    squaresVisited: Set<string>;
}

function latLngToSquareKey(lat: number, lng: number) {
    return encode({ latitude: lat / 1e7, longitude: lng / 1e7 }, 8) ?? fail();
}

function timeToTimeSpan(time: number) {
    return Math.floor(time / TIME_SPAN_DURATION);
}

function isValidActivityRecord(record: unknown): record is ActivityRecord {
    return (
        !!record &&
        typeof record === 'object' &&
        'latitudeE7' in record &&
        'longitudeE7' in record &&
        'accuracy' in record &&
        'activity' in record &&
        'timestamp' in record
    );
}

function isValidLocationWithTime(
    locationWithTime: LocationWithTime
): locationWithTime is LocationWithTime {
    return (
        typeof locationWithTime[0] === 'number' &&
        typeof locationWithTime[1] === 'number' &&
        typeof locationWithTime[2] === 'number'
    );
}

function isAccuracyGood(record: ActivityRecord): record is ActivityRecord {
    return record.accuracy < 50;
}

async function main() {
    const dailyLogFifo = new Fifo<void>();

    const mainChain = chain(createObjectsStreamer())
        .filter(isValidActivityRecord)
        .filter(isAccuracyGood)
        .map((record) => parseLocation(record as ActivityRecord))
        .filter(isValidLocationWithTime)
        .bufferize({
            getInitialValue: (): TimeSpanStatItem => ({
                prevTimeSpan: 0,
                timeSpan: 0,
                size: 0,
                squaresVisited: new Set(),
            }),
            reducer(acc, [lat, lng, time]) {
                acc.prevTimeSpan = acc.timeSpan;
                acc.timeSpan = timeToTimeSpan(time);
                acc.size += 1;
                acc.squaresVisited.add(latLngToSquareKey(lat, lng));
                return acc;
            },
            shouldFlush({ prevTimeSpan, timeSpan }) {
                return prevTimeSpan !== 0 && prevTimeSpan !== timeSpan;
            },
        })
        .tap(() => {
            dailyLogFifo.push();
        })
        .bufferize({
            getInitialValue: (): Map<string, number> => new Map(),
            reducer(acc, value) {
                for (const square of value.squaresVisited) {
                    acc.set(square, (acc.get(square) ?? 0) + 1);
                }
                return acc;
            },
        })
        .onEnd(() => {
            dailyLogFifo.end();
        })
        .tap((pluscodesToVisits) => {
            const sortedPluscodesToVisits = new Map(
                [...pluscodesToVisits.entries()].sort((a, b) => a[1] - b[1])
            );
            for (const [pluscode, visits] of sortedPluscodesToVisits) {
                console.log(`${pluscode}: ${visits}`);
            }
        });

    const logChain = chain(dailyLogFifo)
        .bufferize({
            getInitialValue: () => 0,
            getNextInitialValue: (acc) => acc,
            reducer: (acc) => acc + 1,
            shouldFlush: () => true,
        })
        .tap((daysProcessed) => {
            console.log(`Processed ${daysProcessed} days`);
        });

    await Promise.all([mainChain.consume(), logChain.consume()]);
}

main().catch(console.error);
