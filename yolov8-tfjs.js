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
    const dummyInput = tf.ones(yolov8.inputs[0].shape);
    const warmupResults = yolov8.execute(dummyInput);

    console.log("Model loaded" + warmupResults)
    tf.dispose([warmupResults, dummyInput]);

    let modelDetails = {
        net: yolov8,
        inputShape: yolov8.inputs[0].shape,
    }

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

    // Get Classes from labels.json
    let labels = [];
    let numClass;
    async function getLabels() {
        try {
            const response = await fetch('http://127.0.0.1:5500/labels.json');
            labels = await response.json();
        } catch (error) {
            console.error('Error at fetching labels', error);
        }

        numClass = labels.length;
        console.log("numClass: " + numClass);
    }

    await getLabels();

    const preprocess = (source, modelWidth, modelHeight) => {
        let xRatio, yRatio; // ratios for boxes

        const input = tf.tidy(() => {
            const img = tf.browser.fromPixels(source);
            // console.log(`img shape: ${img.shape}`);
            const [h, w] = img.shape.slice(0, 2); // get source width and height
            const maxSize = Math.max(w, h); // get max size
            // console.log(`modelWidth: ${modelWidth}, modelHeight: ${modelHeight}, w: ${w}, h: ${h}, maxSize: ${maxSize}`);
            const imgPadded = img.pad([
                [0, maxSize - h], // padding y [bottom only]
                [0, maxSize - w], // padding x [right only]
                [0, 0],
            ]);
            // console.log(`imgPadded shape: ${imgPadded.shape}`);


            xRatio = maxSize / w; // update xRatio
            yRatio = maxSize / h; // update yRatio

            const result = tf.image
                .resizeBilinear(imgPadded, [modelWidth, modelHeight]) // resize frame
                .div(255.0) // normalize
                .expandDims(0); // add batch
            // console.log(result.shape);
            return result;
        });

        return [input, xRatio, yRatio];
    };

    async function detect(video, model, ctx) {
        if (video.readyState < 3) {
            return [];
        }

        console.log(model);
        console.log(model.inputs);

        const modelWidth = modelDetails.inputShape[1];
        const modelHeight = modelDetails.inputShape[2];
        
        // Create a temporary canvas to hold the video frame
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const tempContext = tempCanvas.getContext('2d');

        // Draw the video frame onto the temporary canvas
        tempContext.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

        // Pass the temporary canvas (instead of the video) to your preprocess function
        const [input, xRatio, yRatio] = preprocess(tempCanvas, modelWidth, modelHeight);

        // console.log(input);

        const res = model.execute(input); // inference model
        // console.log('res', res);
        const predictions = res.transpose([0, 2, 1]); // transpose result [b, det, n] => [b, n, det]
        // console.log('predictions', predictions);


        const boxes = tf.tidy(() => {
            const w = predictions.slice([0, 0, 2], [-1, -1, 1]); // get width
            const h = predictions.slice([0, 0, 3], [-1, -1, 1]); // get height
            const x1 = tf.sub(predictions.slice([0, 0, 0], [-1, -1, 1]), tf.div(w, 2)); // x1
            const y1 = tf.sub(predictions.slice([0, 0, 1], [-1, -1, 1]), tf.div(h, 2)); // y1
            return tf.concat([y1, x1, tf.add(y1, h), tf.add(x1, w)], 2).squeeze();
        });

        const [scores, classes] = tf.tidy(() => {
            const rawScores = predictions.slice([0, 0, 4], [-1, -1, numClass]).squeeze(0); // COCO have 80 class
            return [rawScores.max(1), rawScores.argMax(1)];
        });

        const nms = await tf.image.nonMaxSuppressionAsync(boxes, scores, 500, 0.45, 0.2);

        const boxes_data = boxes.gather(nms, 0).dataSync();
        const scores_data = scores.gather(nms, 0).dataSync();
        const classes_data = classes.gather(nms, 0).dataSync();
    
        // console.log("boxes_data" + boxes_data);
        // console.log("scores_data" + scores_data);
        // console.log("classes_data" + classes_data);

        const boxes_data2D = [];
        for (let i = 0; i < boxes_data.length; i += 4) {
            boxes_data2D.push(boxes_data.slice(i, i + 4));
        }

        const boundingBoxes = boxes_data2D.map((box, i) => {
            return {
                label: labels[classes_data[i]],
                bbox: [box[1] * xRatio, box[0] * yRatio, (box[3] - box[1]) * xRatio, (box[2] - box[0]) * yRatio],
                score: scores_data[i]
            };
        });

        console.log(boundingBoxes); // add this line


        tf.dispose([input, res, predictions, boxes, scores, classes, nms]);

        boundingBoxes.forEach(result => {
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

        return boundingBoxes;
    }



    // Function to run detection on video frames
    const detectWebcam = async () => {
        if (video.readyState === 4) {
            // Set canvas dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            await detect(video, yolov8, ctx);
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