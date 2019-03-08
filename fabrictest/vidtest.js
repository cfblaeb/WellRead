var canvas = new fabric.Canvas('c');
var webcamEl = document.getElementById('webcam');

var webcam = new fabric.Image(webcamEl, {
  left: 539,
  top: 328,
  angle: 94.5,
  originX: 'center',
  originY: 'center',
  objectCaching: false,
});

// adding webcam video element
navigator.mediaDevices.getUserMedia({video: true}, function getWebcamAllowed(localMediaStream) {
  var video = document.getElementById('webcam');
  video.src = window.URL.createObjectURL(localMediaStream);

  canvas.add(webcam);
  webcam.moveTo(0); // move webcam element to back of zIndex stack
  webcam.getElement().play();
}, function getWebcamNotAllowed(e) {
  console.log("noo webcam")
});

fabric.util.requestAnimFrame(function render() {
  canvas.renderAll();
  fabric.util.requestAnimFrame(render);
});