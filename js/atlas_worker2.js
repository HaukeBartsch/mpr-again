var regionsBySlide;

// if we want to load OpenCV.js in this worker we need to wait for Module to fill up, after the promise...
var Module = {
	onRuntimeInitialized() {
		// this is our application:
		if (typeof cv === "object")
			console.log(cv.getBuildInformation())
	}
};
self.importScripts("/js/opencv.js");
if (typeof cv === "function") {
	const promise = cv().then(function() {
		console.log("cv loaded");
		cv = Module; // this looks broken, but I don't know how to fulfill the promise any other way
	}, function() {
		console.log("Loading of OpenCV failed...");
	});
}
self.importScripts("/js/labelPolygon.js");

waitForOpencv(function(success) {
	if (success) {
		postMessage({
			"action": "OpenCVReady",
			"text": "done loading (opencv)"
		});
	} else {
		console.log("perceived error loading opencv");
		//throw new Error('Error on loading OpenCV');
	}
});

onmessage = function (e) {
    console.log("Message received in atlas worker.");
    if (typeof(e.data["pixels16bit"]) !== "undefined") {
    	// we got 16bit data for processing here
    	// we can loop through all the images between start end end
        var canvas_id = e.data['canvas_id'];
    	var image = e.data["pixels16bit"];
    	var start = e.data["start"]; // start and end don't know about 4 bytes in RGBA
    	var end = e.data["end"];
        var dims = e.data["dims"];
        var atlas_colors = e.data["atlas_colors"];
        var accuracy = 0.2; // how detailed in the polygon approximation?
        if (typeof e.data["accuracy"] != 'undefined')
            accuracy = e.data["accuracy"];
    	//if (typeof end[0] == 'undefined' || typeof dims[0] == 'undefined')
    	//	console.log("found bla bla");

    	var numImX = Math.floor(end[0] / dims[0]);
    	var numImY = Math.floor(end[1] / dims[1]);
    	regionsBySlide = {};
    	for (var x = 0; x < numImX; x++) {
    		postMessage({
    			"action": "message",
    			"text": "num " + (x + 1) + " of " + numImX
    		});
    		for (var y = 0; y < numImY; y++) {
    			var s = [start[0] + x * dims[0], start[1] + y * dims[1]];
    			var e = [s[0] + dims[0], s[1] + dims[1]];
                regionsBySlide[numImX * x + y] = parseData2(image, canvas_id, s, e, atlas_colors, accuracy);
    		}
        }
        // We should also have a legend here, by slice list all the rois with a 
        // center point at which to show the label - and the label.

    	postMessage({
    		"action": "message",
    		"text": "done processing (in parseData of the webworker)!",
    		"result": regionsBySlide
    	});

    	return;
    }

    postMessage({ "action": "message", "text": "got an image object of length: " + image.data.length });

    // we can loop through all the images between start end end
/*    var numImX = Math.floor(end[0] / dims[0]);
    var numImY = Math.floor(end[1] / dims[1]);
    var count = 0;
    regionsBySlide = {};
    for (var y = 0; y < numImY; y++) {
        postMessage({ "action": "message", "text": "num " + (y + 1) + " of " + numImY });
        for (var x = 0; x < numImX; x++) {
            var s = [start[0] + x * dims[0], start[1] + y * dims[1]];
            var e = [s[0] + dims[0], s[1] + dims[1]];
            regionsBySlide[numImX * x + y] = parseData2(image, canvas_id, s, e);
            count++;
        }
    }
    postMessage({ "action": "message", "text": "done processing (in parseData of the webworker)!", "result": regionsBySlide }); */ 
}

Object.defineProperty(Array.prototype, 'chunk', {
	value: function(chunkSize) {
		var R = [];
		for (var i = 0; i < this.length; i += chunkSize)
			R.push(this.slice(i, i + chunkSize));
		return R;
	}
});


function interpolate(t, degree, points, knots, weights, result) {

    var i,j,s,l;              // function-scoped iteration variables
    var n = points.length;    // points count
    var d = points[0].length; // point dimensionality
  
    if(degree < 1) throw new Error('degree must be at least 1 (linear)');
    if(degree > (n-1)) throw new Error('degree must be less than or equal to point count - 1');
  
    if(!weights) {
      // build weight vector of length [n]
      weights = [];
      for(i=0; i<n; i++) {
        weights[i] = 1;
      }
    }
  
    if(!knots) {
      // build knot vector of length [n + degree + 1]
      var knots = [];
      for(i=0; i<n+degree+1; i++) {
        knots[i] = i;
      }
    } else {
      if(knots.length !== n+degree+1) throw new Error('bad knot vector length');
    }
  
    var domain = [
      degree,
      knots.length-1 - degree
    ];
  
    // remap t to the domain where the spline is defined
    var low  = knots[domain[0]];
    var high = knots[domain[1]];
    t = t * (high - low) + low;
  
    if(t < low || t > high) throw new Error('out of bounds');
  
    // find s (the spline segment) for the [t] value provided
    for(s=domain[0]; s<domain[1]; s++) {
      if(t >= knots[s] && t <= knots[s+1]) {
        break;
      }
    }
  
    // convert points to homogeneous coordinates
    var v = [];
    for(i=0; i<n; i++) {
      v[i] = [];
      for(j=0; j<d; j++) {
        v[i][j] = points[i][j] * weights[i];
      }
      v[i][d] = weights[i];
    }
  
    // l (level) goes from 1 to the curve degree + 1
    var alpha;
    for(l=1; l<=degree+1; l++) {
      // build level l of the pyramid
      for(i=s; i>s-degree-1+l; i--) {
        alpha = (t - knots[i]) / (knots[i+degree+1-l] - knots[i]);
  
        // interpolate each component
        for(j=0; j<d+1; j++) {
          v[i][j] = (1 - alpha) * v[i-1][j] + alpha * v[i][j];
        }
      }
    }
  
    // convert back to cartesian and return
    var result = result || [];
    for(i=0; i<d; i++) {
      result[i] = v[s][i] / v[s][d];
    }
  
    return result;
}


function parseData2(image, canvas_slice_id, start, end, atlas_colors, accuracy) {
	let dat = [];
	var w = image.width;
	var h = image.height;
	var channel = 1;
	for (var y = start[1]; y < end[1]; y++) { // for each of the rows get the slice of the data
		var idx1 = (start[0] * channel) + (y * (w * channel));
		var idx2 = idx1 + (channel * (end[0] - start[0]));
		dat = dat.concat(Array.from(image.data.slice(idx1, idx2)));
	}
	dat.width = end[0] - start[0];
	dat.height = end[1] - start[1];
    // how many rows? (Height many), how many columns? (Rows many)
	let src = cv.matFromArray(dat.height, dat.width, cv.CV_16UC1, dat);
    // can we supersample this image to make it appear smoother?
	//let src3 = new cv.Mat(); // .zeros(src.cols, src.rows, cv.CV_8UC4);
    //cv.resize(src, src3, new cv.Size(dat.height*4, dat.width*4), 0, 0, cv.INTER_CUBIC);

	let src2 = new cv.Mat(); // .zeros(src.cols, src.rows, cv.CV_8UC4);
	var labelsInThisSlice = {};
	for (var i = 0; i < dat.length; i++) {
		if (dat[i] > 0) {
			labelsInThisSlice[dat[i]] = 1;
		}
	}
	labelsInThisSlice = Object.keys(labelsInThisSlice);
    var contour_array = {};
    var label_array = {}; // store the location of each label for a contour
	for (var labelIdx = 0; labelIdx < labelsInThisSlice.length; labelIdx++) {
        var label = parseInt(labelsInThisSlice[labelIdx]);
        // for now remove some of the large label (white and gray matter)

        //atlas_colors[label+1][0]
        var blank_names = [ "Left-Cerebral-White-Matter", 
                            "Right-Cerebral-White-Matter",
                            "Left-Cerebral-Cortex",
                            "Right-Cerebral-Cortex",
                            "Left-choroid-plexus",
                            "Right-choroid-plexus"
                         ];
        if (blank_names.indexOf(atlas_colors[label+1][0]) != -1)
            continue;

		const lower = cv.matFromArray(1, 1, cv.CV_16UC1, [
			label
		]);
		const higher = cv.matFromArray(1, 1, cv.CV_16UC1, [
			label
		]);
        cv.inRange(src, lower, higher, src2);
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        // TODO: this retrieves the contours in a 2 level hierarchy. This means that we have information
        // about holes in contour - but our code below does not use that information!
        cv.findContours(src2, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
        var idx = 1;
        for (let i = 0; i < contours.size(); i++) {
            // I assume that in some cases a contour has more than one array,
            // those are rings (holes). We should keep them in the structure for polylabel.
            if (i == 0) {
                contour_array[label] = [];
                label_array[label] = [];
            }
            // simplify the contour
        	let tmp = new cv.Mat();
        	let cnt = contours.get(i);
            // do we have a hole here?
            let hole = false;
            let hier = hierarchy.intPtr(0,i);
            if (hier[3] != -1) {
                //console.log("we have a hole here...");
                hole = true;
            }

            // lets try to interpolate instead with 
            var degree = 2;
            //  let's the algorithms compute the number of knots
            //var knots = [
            //    0, 1, 2, 3, 4, 5, 6, 7, 8, 9
            //];
            var points = Array.from(cnt.data).chunk(4).map(function(a) {
        		return a[0];
        	}).chunk(2);
            // now repeat the first degree + 1 points to make this a closed curve
            for (let j = 0; j < degree + 1; j++) {
                points.push(points[j]);
            }

            var originalNumPoints = points.length - (degree + 1); // without the repeated points
            var maxT = 1.0 - 1.0 / (originalNumPoints + 1);
            var newPoints = [];
            for(var t=0; t<1; t+=0.01) {
                var point = interpolate(t * maxT, degree, points, null, null);
                newPoints.push(point);
            }
            // we can set the accuracy to 10% or the arc-length
            //accuracy = 0.01*cv.arcLength(cnt, true);
            //cv.approxPolyDP(cnt, tmp, accuracy, true);
            let moments = cv.moments(cnt, false);
            let centroid_x = moments.m10 / moments.m00;
            let centroid_y = moments.m01 / moments.m00;
            let area = cv.contourArea(cnt);
            let perimeter = cv.arcLength(cnt, true);
        	//var data = Array.from(tmp.data).chunk(4).map(function(a) {
        	//	return a[0];
        	//}).chunk(2);
            data = newPoints;
            contour_array[label].push(data);

            // We could do better here for the placement of labels.
            // Best would be to find the largest inscribing circle for the
            // polygon and to place the label at that location. This
            // can be done brute force using a pointPolygonTest on all
            // grid locations inside the contour.
            var center = polylabel([data], 0.1);

            label_array[label].push({
                centroid: [center[0], center[1]],
                inclosing_radius: center.distance,
            	area: area,
            	perimeter: perimeter,
            	label: label,
                hole: hole,
            	name: atlas_colors[label+1][0]
            });
        }
        contours.delete();
        hierarchy.delete();
    }
    src.delete();
    src2.delete();
    return {
    	contour_array: contour_array,
    	label_array: label_array
    };
}


function waitForOpencv(callbackFn, waitTimeMs = 60000, stepTimeMs = 100) {
    if (cv.Mat) callbackFn(true)

    let timeSpentMs = 0
    const interval = setInterval(() => {
        const limitReached = timeSpentMs > waitTimeMs
        if (cv.Mat || limitReached) {
            clearInterval(interval)
            return callbackFn(!limitReached)
        } else {
            timeSpentMs += stepTimeMs
        }
    }, stepTimeMs)
}