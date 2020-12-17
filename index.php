<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <meta name="description" content="">
    <meta name="authofr" content="">
    <link href="css/style.css" rel="stylesheet">
    
    <title>Some test this is</title>
  </head>
  <BODY>
  <div style="margin: 0px;">
  <div class="left">
<!--    <div class="MPR">
      <img id="mpr3" class="primary" src="data/T1Sagittal.jpg"/>
      <img id="mpr3-overlay" class="overlay" src="data/T2Sagittal.jpg"/>
      <div style="position: absolute; bottom: 0px; right: 5px; font-size: 9pt; color: yellow;" id="mpr3_message1"></div>
      <div style="position: absolute; bottom: 20px; right: 5px; font-size: 9pt; color: yellow;" id="mpr3_message2"></div>
      <div class="crosshair-horizontal"></div>
      <div class="crosshair-vertical"></div>
    </div>
    <div class="MPR">
      <img id="mpr2" class="primary" src="data/T1Coronal.jpg"/>
      <img id="mpr2-overlay" class="overlay" src="data/T2Coronal.jpg"/>
      <div style="position: absolute; bottom: 0px; right: 5px; font-size: 9pt; color: yellow;" id="mpr2_message1"></div>
      <div style="position: absolute; bottom: 20px; right: 5px; font-size: 9pt; color: yellow;" id="mpr2_message2"></div>
      <div class="crosshair-horizontal"></div>
      <div class="crosshair-vertical"></div>
    </div> -->
  </div>
  <div class="right">
    <div class="MPRR">
      <canvas id="mpr1" class="primary"/draggable="false" ondragstart="return false;"></canvas>
      <canvas id="mpr1_overlay" class="overlay" draggable="false" ondragstart="return false;"></canvas>
      <canvas id="mpr1_atlas" class="atlas" draggable="false" ondragstart="return false;"></canvas>
      <div class="message" style="bottom: 0px; right: 5px;"><span id="mpr1_message1"></span></div>
      <div class="message" style="bottom: 20px; right: 5px;"><span id="mpr1_message2"></span></div>
      <div class="message" style="bottom: 40px; right: 5px;"><span id="mpr1_message3"></span></div>
      <div class="crosshair-horizontal"></div>
      <div class="crosshair-vertical"></div>
    </div>
  </div>

  </div>  

    <script src="js/jquery-3.2.1.min.js" type="text/javascript"></script>
    <script src="js/popper.min.js" type="text/javascript"></script>
    <script src="js/bootstrap.min.js" type="text/javascript"></script>
    <script src="js/colormaps.js" type="text/javascript"></script>
    <script src="js/opencv.js" type="text/javascript"></script>    
    <script src="js/all.js" type="text/javascript"></script>
  </BODY>
</HTML>
