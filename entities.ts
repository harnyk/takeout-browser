// {
//   latitudeE7: 498135381,
//   longitudeE7: 239857752,
//   accuracy: 10,
//   activity: [
//     {
//       activity: [
//         {
//           type: "TILTING",
//           confidence: 100,
//         },
//       ],
//       timestamp: "2022-07-16T06:13:04.607Z",
//     },
//     {
//       activity: [
//         {
//           type: "STILL",
//           confidence: 98,
//         },
//         {
//           type: "UNKNOWN",
//           confidence: 2,
//         },
//       ],
//       timestamp: "2022-07-16T06:13:34.659Z",
//     },
//   ],
//   source: "GPS",
//   deviceTag: 272191583,
//   timestamp: "2022-07-16T06:13:34.749Z",
// }
export interface Activity {
    type: string;
    confidence: number;
}

export interface ActivityRecord {
    latitudeE7: number;
    longitudeE7: number;
    accuracy: number;
    activity: ActivityItem[];
    source: string;
    deviceTag: number;
    timestamp: string;
}

export interface ActivityItem {
    activity: Activity[];
    timestamp: string;
}

export type LocationWithTime = [lat: number, lng: number, time: number];

export function parseLocation(r: ActivityRecord): LocationWithTime {
    const { latitudeE7, longitudeE7, timestamp } = r;
    return [latitudeE7, longitudeE7, new Date(timestamp).getTime()];
}
