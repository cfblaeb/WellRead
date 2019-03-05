// dom element shortcuts
let video_source_selector = document.getElementById('video_source_select');
let hidden_video = document.getElementById('hidden_video');
let result_table = document.getElementById('result_table');
let camera_canvas = document.getElementById('camera_canvas');
let action_button = document.getElementById('startbutton');
let cc_context = camera_canvas.getContext('2d');
let cam_on = true;

let width = 0;
let height = 0;
let no_rows = 8;
let no_columns = 12;
let square_size = 0;

let clipboard = new ClipboardJS('.btn');
clipboard.on('success', function(e) {
    e.clearSelection();
});

function set_video_and_stuff(stream) {
    window.stream = stream;
    hidden_video.srcObject=stream;
    width = window.stream.getVideoTracks()[0].getSettings().width;
    height = window.stream.getVideoTracks()[0].getSettings().height;
    camera_canvas.width = width;
    camera_canvas.height = height;
    cc_context = camera_canvas.getContext('2d');
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
    if (cam_on) {
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
    }
};

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

function recall() {
    render();
    if (cam_on) setTimeout(recall, 0);
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
    if (cam_on) {
        if (window.stream) {window.stream.getTracks().forEach(function(track) {track.stop();});}
        navigator.mediaDevices.getUserMedia({video:{deviceId: {exact: event.target.value}}}).then(
            (stream)=> {set_video_and_stuff(stream);},(error)=>console.log('got media error:', error)
        );
    }
}

function takepicture() {
    let ws = new WebSocket("wss://wellread.ebdrup.biosustain.dtu.dk/ws");
    ws.onopen = () => {
        camera_canvas.toBlob((blob) => ws.send(blob));
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
            let imageUrl = URL.createObjectURL(msg.data);
            let img = new Image();
            img.onload = () => cc_context.drawImage(img, 0, 0, width, height);
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
            (stream)=> {
                set_video_and_stuff(stream);
                recall();
                },
            (error)=>console.log('got media error:', error)
        );
    }
    ev.preventDefault();
    }, false);