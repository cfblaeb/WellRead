// dom element shortcuts
let video_source_selector = document.getElementById('video_source_select');
let video_el = document.getElementById('video_id');
let canvas_el = document.getElementById('canvas_id');

let result_table = document.getElementById('result_table');
let action_button = document.getElementById('startbutton');

let cam_on = true;

let width = 640;
let height = 480;
let no_rows = 8;
let no_columns = 12;
let square_size = 0;

let canvas = new fabric.Canvas('canvas_id', {
    selection: false,
    selectionLineWidth: 2
});
let webcam = new fabric.Image(video_el, {
    left: 0,
    top: 0,
    objectCaching: false,
});
let pl = new fabric.Polyline([
    {x: 10, y: 10},
    {x: 10, y: 100},
    {x: 100, y: 100},
    {x: 100, y: 10},
    {x: 10, y: 10},
    {x: 40, y: 100}
], {
    fill: 'transparent',
    stroke: 'red',
    left: 10,
    top: 10
});

let clipboard = new ClipboardJS('.btn');
clipboard.on('success', function(e) {
    e.clearSelection();
});

function set_video_and_stuff(stream) {
    width = stream.getVideoTracks()[0].getSettings().width;
    height = stream.getVideoTracks()[0].getSettings().height;
    //canvas_el.width = width;
    //canvas_el.height = height;
    //video_el.width = width;
    //video_el.height = height;
    window.stream = stream;
    video_el.srcObject=stream;
    canvas.add(webcam);
    webcam.moveTo(0);
    webcam.getElement().play();

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

// list cameras
navigator.mediaDevices.enumerateDevices().then(
    (devices) => {
        devices.forEach((device) => {
            if (device.kind === 'videoinput') {
                let device_option = document.createElement("option");
                device_option.value = device.deviceId;
                device_option.text = device.deviceId;
                video_source_selector.add(device_option)
}});});

// activate camera
navigator.mediaDevices.getUserMedia({video:true}).then(
    (stream)=> { set_video_and_stuff(stream); },
    (error)=>console.log('got media error:', error)
);

// change camera
function changeVideoSource(event) {
    if (cam_on) {
        if (window.stream) {window.stream.getTracks().forEach(function(track) {track.stop();});}
        navigator.mediaDevices.getUserMedia({video:{deviceId: {exact: event.target.value}}}).then(
            (stream)=> {set_video_and_stuff(stream);},(error)=>console.log('got media error:', error)
        );
    }
}

function takepicture() {
    //let ws = new WebSocket("wss://wellread.ebdrup.biosustain.dtu.dk/ws");
    let ws = new WebSocket("ws://localhost:8765");
    ws.onopen = () => {
        canvas_el.toBlob((blob) => ws.send(blob));
        cam_on = false;
        action_button.innerText = "start camera";
        if (window.stream) {window.stream.getTracks().forEach(function(track) {track.stop();});}

    };
    ws.onmessage = (msg) => {
        if (typeof(msg.data)=="string") {
            let results = JSON.parse(msg.data);
            results.forEach((result) => {
                let new_row = result_table.insertRow(-1);
                let row_cell = new_row.insertCell(0);
                let col_cell = new_row.insertCell(1);
                let barcode_cell = new_row.insertCell(2);
                let row_text = document.createTextNode(result.row);
                let col_text = document.createTextNode(result.col);
                let barcode_text = document.createTextNode(result.barcode);
                row_cell.appendChild(row_text);
                col_cell.appendChild(col_text);
                barcode_cell.appendChild(barcode_text);
            });
        } else {
            window.mydata = msg.data;
            let imageUrl = URL.createObjectURL(msg.data);
            let img = new Image();
            img.onload = () => {
                let faim = new fabric.Image(img);
                canvas.add(faim);
            };
            img.src = imageUrl;
        }
    }
}

//event listeners
document.addEventListener('DOMContentLoaded',() => video_source_selector.onchange=changeVideoSource,false);
action_button.addEventListener('click', (ev) => {
    if (cam_on) {takepicture();}
    else {
        cam_on = true;
        action_button.innerText = "take photo";
        navigator.mediaDevices.getUserMedia({video:true}).then(
            (stream)=> { set_video_and_stuff(stream); },
            (error)=>console.log('got media error:', error)
        );
    }
    ev.preventDefault();
    }, false);


canvas.add(pl);
fabric.util.requestAnimFrame(function render() {
    canvas.renderAll();
    fabric.util.requestAnimFrame(render);
});