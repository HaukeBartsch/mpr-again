var regionsBySlide;

onmessage = function (e) {
    console.log("Message received in atlas worker.");
    var image = e.data["pixels"];
    var width = e.data["width"];
    var height = e.data["height"];

    postMessage({ "action": "message", "text": "got an image object of length: " + image.data.length });
    parseData(image);
}

function parseData(image) {
    // we should start processing the image here

    postMessage({ "action": "message", "text": "done processing (in parseData of the webworker)!" });
}

postMessage({ "action": "message", "text": "done loading" });
