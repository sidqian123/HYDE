import * as ort from "onnxruntime-web";

let modelSession;

// Load ONNX model
async function loadModel() {
    modelSession = await ort.InferenceSession.create("minilm.onnx");
}

// Convert ingredient text into embeddings
async function getEmbedding(text) {
    if (!modelSession) await loadModel();

    let inputTensor = new ort.Tensor("float32", new Float32Array([text.length]), [1, text.length]);
    let results = await modelSession.run({ input: inputTensor });
    return results.output.data;
}

// Compute cosine similarity
function cosineSimilarity(vecA, vecB) {
    let dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    let magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    let magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

// Expose functions globally
window.getEmbedding = getEmbedding;
window.cosineSimilarity = cosineSimilarity;

// Load the model once
loadModel();
