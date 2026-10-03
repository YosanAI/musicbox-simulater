/** Read the container; mesh interpretation is a separate step. */
export function decodeGLB(arrayBuffer) {
  const dataView = new DataView(arrayBuffer);
  if (dataView.byteLength < 20 || dataView.getUint32(0, true) !== 0x46546c67) {
    throw Error('Not a binary glTF (.glb) file.');
  }
  if (dataView.getUint32(4, true) !== 2) {
    throw Error('Only glTF 2.0 is supported.');
  }
  if (dataView.getUint32(8, true) !== arrayBuffer.byteLength) {
    throw Error('The GLB is truncated or has an invalid length.');
  }
  let cursor = 12;
  let json;
  let binary;
  while (cursor + 8 <= dataView.byteLength) {
    let chunkLength = dataView.getUint32(cursor, true);
    let chunkType = dataView.getUint32(cursor + 4, true);
    if (cursor + 8 + chunkLength > dataView.byteLength) {
      throw Error('Invalid GLB chunk length.');
    }
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(arrayBuffer, cursor + 8, chunkLength)).trim());
    }
    if (chunkType === 0x004e4942) {
      binary = arrayBuffer.slice(cursor + 8, cursor + 8 + chunkLength);
    }
    cursor += chunkLength + 8;
  }
  if (!json || !binary) {
    throw Error('This GLB is missing its JSON or binary geometry.');
  }
  return { json, buffers: [binary] };
}
/** Embedded buffers only. This importer never fetches external URLs. */
export function decodeGLTF(text) {
  let json = JSON.parse(text);
  if (String(json.asset?.version) !== '2.0') {
    throw Error('Only glTF 2.0 is supported.');
  }
  let buffers = (json.buffers || []).map(buffer => {
    if (!buffer.uri || !buffer.uri.startsWith('data:') || !buffer.uri.includes(';base64,')) {
      throw Error('Use a self-contained GLB, or a glTF with embedded base64 buffers. External files are not fetched.');
    }
    let binaryString = atob(buffer.uri.split(',')[1]);
    let bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  });
  return { json, buffers };
}
