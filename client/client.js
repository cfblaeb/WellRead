// dom element shortcuts
let video_source_selector = document.getElementById('video_source_select');
let hidden_video = document.getElementById('hidden_video');
let camera_canvas = document.getElementById('camera_canvas');
let return_canvas = document.getElementById('return_canvas');
let cc_context = camera_canvas.getContext('2d');
let rc_context = return_canvas.getContext('2d');

let width = 0;
let height = 0;
let no_rows = 8;
let no_columns = 12;
let square_size = 0;

function set_video_and_stuff(stream) {
    window.stream = stream;
    hidden_video.srcObject=stream;
    width = window.stream.getVideoTracks()[0].getSettings().width;
    height = window.stream.getVideoTracks()[0].getSettings().height;
    camera_canvas.width = width;
    camera_canvas.height = height;
    return_canvas.width = width;
    return_canvas.height = height;
    cc_context = camera_canvas.getContext('2d');
    rc_context = return_canvas.getContext('2d');
    cc_context.lineWidth = 2;
    if (width>height) {
        square_size = width/12;
        no_rows = 8;
        no_columns = 12;
    } else {
        square_size = height/12;
        no_rows = 12;
        no_columns = 8;
    }
}

//copy video source to canvas so we can draw on it
let render = () => {
    cc_context.drawImage(hidden_video, 0, 0, width, height);
    for (let row = 1; row<no_rows; row++ ) {
        cc_context.moveTo(0,row*square_size);
        cc_context.lineTo(no_columns*square_size,row*square_size);
    }
    for (let column = 1; column<no_columns; column++ ) {
        cc_context.moveTo(column*square_size, 0);
        cc_context.lineTo(column*square_size,no_rows*square_size);
    }
    cc_context.stroke();
};

// list cameras
navigator.mediaDevices.enumerateDevices().then(
    (devices) => {
        devices.forEach((device) => {
            if (device.kind == 'videoinput') {
                let device_option = document.createElement("option");
                device_option.value = device.deviceId;
                device_option.text = device.deviceId;
                video_source_selector.add(device_option)
}});});

function recall() {
    render();
    setTimeout(recall, 0);
}

// activate camera
navigator.mediaDevices.getUserMedia({video:true}).then(
    (stream)=> {
        set_video_and_stuff(stream);
        recall();
    },
    (error)=>console.log('got media error:', error)
);

// change camera
function changeVideoSource(event) {
    if (window.stream) {window.stream.getTracks().forEach(function(track) {track.stop();});}
    navigator.mediaDevices.getUserMedia({video:{deviceId: {exact: event.target.value}}}).then(
        (stream)=> {set_video_and_stuff(stream);},(error)=>console.log('got media error:', error)
    );
}

function takepicture() {
    let ws = new WebSocket("ws://localhost:8765");
    ws.onopen = () => camera_canvas.toBlob((blob) => ws.send(blob));
    ws.onmessage = (msg) => {
        //window.msg = msg
        console.log(msg);
        let imageUrl = URL.createObjectURL(msg.data);
        let img = new Image();
        img.onload = () => rc_context.drawImage(img, 0, 0, width, height);
        img.src = imageUrl;
    }
}

//event listeners
document.addEventListener('DOMContentLoaded',() => video_source_selector.onchange=changeVideoSource,false);
document.getElementById('startbutton').addEventListener('click', function(ev){
    takepicture();
    ev.preventDefault();
    }, false);