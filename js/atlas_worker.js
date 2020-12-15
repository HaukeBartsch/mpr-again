var regionsBySlide;

onmessage = function (e) {
    console.log("Message received in atlas worker.");
    var image = e.data["pixels"];
    var start = e.data["start"]; // start and end don't know about 4 bytes in RGBA
    var end = e.data["end"];
    var dims = e.data["dims"];

    postMessage({ "action": "message", "text": "got an image object of length: " + image.data.length });

    // we can loop through all the images between start end end
    var numImX = Math.floor(end[0] / dims[0]);
    var numImY = Math.floor(end[1] / dims[1]);
    var count = 0;
    regionsBySlide = {};
    for (var y = 0; y < numImY; y++) {
        postMessage({ "action": "message", "text": "num " + (y + 1) + " of " + numImY });
        for (var x = 0; x < numImX; x++) {
            var s = [start[0] + x * dims[0], start[1] + y * dims[1]];
            var e = [s[0] + dims[0], s[1] + dims[1]];
            regionsBySlide[numImY * y + x] = parseData(image, s, e);
            count++;
        }
    }
    postMessage({ "action": "message", "text": "done processing (in parseData of the webworker)!", "result": regionsBySlide });
}

function parseData(image, start, end) {
    // we should start processing the image here
    var width = image.width;
    var height = image.height;

    //  scan-line algorithm in the box defined by start/end
    // we have to look in +x and in +y to see all the borders
    var points = [...Array(4096).keys()].map(function (x) { return []; });
    //    for (var i = 0; i < 4096; i++) {
    //        points[i] = [];
    //    }
    for (var y = start[1]; y < end[1] - 1; y++) {
        var idx0 = y * width * 4 + (start[0] * 4); // the row above
        var idx1 = (y + 1) * width * 4 + (start[0] * 4); // the row below
        for (var x = start[0]; x < end[0] - 1; x++) {

            // we only need to check the red component in the image
            var val0 = image.data[idx0];
            var val1 = image.data[idx0 + 4]; // next right
            var val2 = image.data[idx1]; // next down
            if (val0 != val1) { // integer compare
                // add the first point
                if (val0 != 0) {
                    points[val0].push([
                        x + 0.4, y
                    ]);
                }
                if (val1 != 0) {
                    points[val1].push([
                        x + 0.6, y
                    ]);
                }
            }
            if (val0 != val2) {
                // add the first point
                if (val0 != 0) {
                    points[val0].push([
                        x, y + 0.4
                    ]);
                }
                if (val2 != 0) {
                    points[val2].push([
                        x, y + 0.6
                    ]);
                }
            }

            // just advance the idx
            idx0 += 4;
            idx1 += 4;
        }
        // next we need to connect the points with line segments
    }
    return points.filter(function (a) { return a.length > 0; });
}

postMessage({ "action": "message", "text": "done loading" });
