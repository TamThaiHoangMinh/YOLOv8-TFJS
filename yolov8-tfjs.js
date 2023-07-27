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

// Combine this with "es6-string-html" to get a nice syntax and color for HTML instead of single color text
const html = (strings, ...values) =>
  String.raw(strings, ...values)
    .split('\n')
    .map(line => line.trim())
    .join('');

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

    // Fetch model details
    let modelDetails = {
        net: yolov8,
        inputShape: yolov8.inputs[0].shape,
    }
    const modelWidth = modelDetails.inputShape[1];
    const modelHeight = modelDetails.inputShape[2];

    // Prepare UI
    const main_container = document.createElement("div");
    main_container.className = "flex w-full h-full justify-center items-center";

    // Create elements as in your React code.
    main_container.innerHTML = html`
    <div class="">
        <div class="flex flex-col items-center justify-center">
            <div class="inline-block text-center text-2xl mt-4 mb-6 font-bold 
            uppercase bg-gradient-to-r from-violet-600 to-blue-600 uppercase font-semibold mb-5  bg-clip-text text-transparent">
                <h1>Real-time object detection with Tensorflow JS</h1>
            </div>
            <div class="relative">
                <video id="camera" style ="border-radius: 5px" autoplay muted></video>
                <canvas id="canvas" style="position: absolute; width: 100%; height: 100%; top: 0; left: 0;"></canvas>
            </div>
        </div>
    </div>
    `;
    box.injectNode(main_container);


    // Access the video and canvas elements
    const video = main_container.querySelector('video');
    const canvas = main_container.querySelector('#canvas');
    const ctx = canvas.getContext("2d");

    canvas.width = 640;
    canvas.height = 640;    

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

    // Render bounding boxes and their labels name + scores on canvas
    const renderBoxes = (boxes_data, scores_data, classes_data, ratios) => {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // clean canvas
      
        const colors = new Colors();
      
        // font configs
        const font = `${Math.max(
          Math.round(Math.max(ctx.canvas.width, ctx.canvas.height) / 40),
          14
        )}px Arial`;
        ctx.font = font;
        ctx.textBaseline = "top";

        for (let i = 0; i < scores_data.length; ++i) {
            // filter based on class threshold
            const klass = labels[classes_data[i]];
            const color = colors.get(classes_data[i]);
            const score = (scores_data[i] * 100).toFixed(1);

            // console.log("score: " + score + " klass: " + klass + " color: " + color)
        
            let [y1, x1, y2, x2] = boxes_data.slice(i * 4, (i + 1) * 4);
            x1 *= ratios[0];
            x2 *= ratios[0];
            y1 *= ratios[1];
            y2 *= ratios[1];
            const width = x2 - x1;
            const height = y2 - y1;

            // console.log("width: " + width + " height: " + height)
            // console.log("x1: " + x1 + " y1: " + y1 + " x2: " + x2 + " y2: " + y2)
            // draw box.
            ctx.fillStyle = Colors.hexToRgba(color, 0.1);
            ctx.fillRect(x1, y1, width, height);
        
            // draw border box.
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(Math.min(ctx.canvas.width, ctx.canvas.height) / 200, 2.5);
            ctx.strokeRect(x1, y1, width, height);
        
            // Draw the label background.
            ctx.fillStyle = color;
            const textWidth = ctx.measureText(klass + " - " + score + "%").width;
            const textHeight = parseInt(font, 10); // base 10
            const yText = y1 - (textHeight + ctx.lineWidth);
            ctx.fillRect(
            x1 - 1,
            yText < 0 ? 0 : yText, // handle overflow label box
            textWidth + ctx.lineWidth,
            textHeight + ctx.lineWidth
            );
        
            // Draw labels
            ctx.fillStyle = "#ffffff";
            ctx.fillText(klass + " - " + score + "%", x1 - 1, yText < 0 ? 0 : yText);
        }
      };
      
      class Colors {
        constructor() {
          this.palette = [
            "#757BC8",
            "#8187DC",
            "#8E94F2",
            "#9FA0FF",
            "#ADA7FF",
            "#BBADFF",
            "#CBB2FE",
            "#DAB6FC",
            "#DDBDFC",
            "#E0C3FC",
          ];
          this.n = this.palette.length;
        }
      
        get = (i) => this.palette[Math.floor(i) % this.n];
      
        static hexToRgba = (hex, alpha) => {
          var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result
            ? `rgba(${[parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)].join(
                ", "
              )}, ${alpha})`
            : null;
        };
      }


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

        // console.log(model);
        // console.log(model.inputs);
   
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

        // console.log(boundingBoxes); // add this line

        tf.dispose([input, res, predictions, boxes, scores, classes, nms]);

        renderBoxes(boxes_data, scores_data, classes_data, [xRatio, yRatio]);

        return boundingBoxes;
    }

    // Function to run detection on video frames
    const detectWebcam = async () => {
        if (video.readyState === 4) {
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