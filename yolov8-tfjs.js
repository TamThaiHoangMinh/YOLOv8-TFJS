// To load script from CDN, we need to use a window object that is not the same as the one in the plugin
const loadScript = (boxWindow, url) => {
    return new Promise(async (resolve, reject) => {
        try {
            const script = boxWindow.document.createElement("script");
            script.defer = true;
            script.referrerPolicy = "origin"

            script.src = url;
            boxWindow.document.head.appendChild(script);
            script.addEventListener("load", () => resolve(undefined));
        } catch (e) {
            reject();
        }
    });
}

const loadCDN = async (boxWindow) => {
    await loadScript(boxWindow, `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0`);
    await loadScript(boxWindow, `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@3.11.0`);
    await loadScript(boxWindow, `https://cdn.tailwindcss.com`);
};

const YOLOv8_TFJS = async (box) => {
    await loadCDN(box.window);
    const tf = box.window.tf;

    // Model configs
    const modelName = "yolov8n";

    const yolov8 = await tf.loadGraphModel(
        `http://127.0.0.1:5500/yolov8n_web_model/model.json`
    ); // Load model

    // Warming up model
    // const dummyInput = tf.ones(yolov8.inputs[0].shape);
    // const warmupResults = yolov8.execute(dummyInput);

    // Prepare UI
    const main_container = document.createElement("div");
    main_container.className = "flex w-full h-full overflow-hidden";

    // Create elements as in your React code.
    // You would need to implement listeners, add appropriate styles, and adjust to suit your needs.
    main_container.innerHTML = `
        <div>
            <h1>📷 YOLOv8 Live Detection App</h1>
            <p>YOLOv8 live detection application on browser powered by tensorflow.js</p>
            <p>Serving : <code>${modelName}</code></p>
        </div>
        <div>
            <img id="image" src="#" />
            <video id="camera" autoplay muted></video>
            <video id="video" autoplay muted></video>
        </div>
        <button id="button-handler">Handle</button>
    `;

    box.injectNode(main_container);
}

const plugin = async ({ widgets, simulator, vehicle }) => {
    widgets.register('YOLOv8_TFJS_Widget', (box) => { YOLOv8_TFJS(box) })
}

export default plugin;
