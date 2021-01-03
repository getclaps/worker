// export function simpleSerialize(x) {
//   if (x instanceof Object) {
//     if ('toJSON' in x)
//       return x.toJSON();
//     if (Symbol.iterator in x)
//       return [...x].map(simpleSerialize);

//     const arr = [];
//     for (const k in x) {
//       if (typeof x[k] !== 'function') {
//         arr.push([k, simpleSerialize(x[k])]);
//       }
//     }
//     return arr.sort()
//   }
//   return x;
// }

// function simpleSerialize2X(x) {
//   if (x instanceof Array) {
//     return x.map(simpleSerialize2X);
//   }
//   if (x instanceof Object) {
//     return Object.entries(x)
//       .map(([k, v]) => [k, simpleSerialize2X(v)])
//       .sort();
//   }
//   return x;
// }

// function simpleSerialize2(x) {
//   return simpleSerialize2X(JSON.parse(JSON.stringify(x)))
// }