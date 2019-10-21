module.exports = {

  degreesToRadians: (degrees) => degrees * (Math.PI / 180),

  sleep: async (time) => new Promise(resolve => setTimeout(resolve, time)),

  chunker: (arr, chunkSize) => {

    chunks = [];

    arr.forEach(value => {
      if (chunks.length === 0) {
        chunks = [[value]];
      } else {
        let lastChunk = chunks[chunks.length - 1];
        if (lastChunk.length < chunkSize) {
          lastChunk.push(value)
        } else {
          chunks.push([value]);
        }
      }
    });

    return chunks;

  }

}
