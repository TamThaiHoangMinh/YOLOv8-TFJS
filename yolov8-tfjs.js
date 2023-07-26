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
    main_container.innerHTML = `
        <div>
            <h1>📷 YOLOv8 Live Detection App</h1>
            <p>YOLOv8 live detection application on browser powered by tensorflow.js</p>
            <p>Serving : <code>${modelName}</code></p>
        </div>
        <div>
            <img id="image" src="#" />
            <video id="camera" autoplay muted></video>
            <canvas id="canvas"></canvas>
        </div>
        <button id="button-handler">Handle</button>
    `;

    box.injectNode(main_container);

    // Access the video and canvas elements
    const video = main_container.querySelector('video');
    const canvas = main_container.querySelector("canvas");
    const ctx = canvas.getContext("2d");

    // Function to run detection on video frames
    const detectWebcam = async () => {
        if (video.readyState === 4) {
            // Set canvas dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Run detection and draw results on the canvas
            const results = await detect(video, yolov8, ctx);
            // Assuming "detect" function will return bounding boxes and labels, etc.
            results.forEach(result => {
                // Assuming each result has a bounding box and label
                ctx.beginPath();
                ctx.rect(result.bbox[0], result.bbox[1], result.bbox[2], result.bbox[3]);
                ctx.lineWidth = 2;
                ctx.strokeStyle = "red";
                ctx.fillStyle = "red";
                ctx.stroke();
                ctx.fillText(
                    result.label,
                    result.bbox[0],
                    result.bbox[1] > 10 ? result.bbox[1] - 5 : 10
                );
            });

            // Call this function again to detect the next frame
            window.requestAnimationFrame(detectWebcam);
        }
    };

    // Get video from webcam
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                video.play();
                // Start detection once video is loaded
                window.requestAnimationFrame(detectWebcam);
            };
        });
};

const plugin = async ({ widgets, simulator, vehicle }) => {
    widgets.register('YOLOv8_TFJS_Widget', (box) => { YOLOv8_TFJS(box) })
}

export default plugin;