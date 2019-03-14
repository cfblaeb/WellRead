// dom element shortcuts
let video_el = document.getElementById('video_id');
let canvas_el = document.getElementById('canvas_id');
let video_source_selector = document.getElementById('video_source_select');

let back_button = document.getElementById('back_btn');
let fwd_button = document.getElementById('fwd_btn');

let result_table = document.getElementById('result_table');

let program_state = 0;
/*
    0: Taking a picture of the plate
        camera          on
        fwd button text take picture
        button action   stop camera
    1: Align well grid
        camera          off
        canvas          show photo and overlay interactive grid
        fwd button text analyze barcodes
        button action   send image and grid to server
    2: Results
        camera          off
        canvas          show photo and color coded grid
        fwd_button text restart
        button action   goto status 0
*/

document.addEventListener('DOMContentLoaded',() => video_source_selector.onchange=start_camera,false);

// activate copy/paste button
let clipboard = new ClipboardJS('.btn');
clipboard.on('success', function(e) {
    e.clearSelection();
});

function draw_grid() {
    // plate dimensions
    let no_rows = 8;
    let no_columns = 12;
    console.log("drawing grid");
    let square_size = 0;

    if (canvas.width>canvas.height) {
        square_size = canvas.width/12;
        no_rows = 8;
        no_columns = 12;
    } else {
        square_size = canvas.height/12;
        no_rows = 12;
        no_columns = 8;
    }

    let lines = [];
    for (let row = 1; row<no_rows; row++ ) {
        lines.push(new fabric.Line([ 0, row*square_size, no_columns*square_size, row*square_size], {stroke: '#FF0000'}))
    }
    for (let column = 1; column<no_columns; column++ ) {
        lines.push(new fabric.Line([ column*square_size, 0, column*square_size, no_rows*square_size], {stroke: '#FF0000'}))
    }
    let pl = new fabric.Group(lines);
    canvas.add(pl);
}

// list cameras
navigator.mediaDevices.enumerateDevices().then(
    (devices) => {
        devices.forEach((device) => {
            if (device.kind === 'videoinput') {
                let device_option = document.createElement("option");
                device_option.value = device.deviceId;
                if (device.label) device_option.text = device.label;
                else device_option.text = device.deviceId;
                video_source_selector.add(device_option)
}});});

function start_camera() {
    navigator.mediaDevices.getUserMedia({
        video: {
            width: 1920,
            height: 1080
        },
        deviceId: {exact: video_source_selector.value}
    }).then(
        (stream)=> {
            console.log("Starting camera");
            console.log(stream.getTracks()[0].getSettings());
            //window.vtrack = stream.getTracks()[0];

            video_source_selector.value = stream.getTracks()[0].getSettings().deviceId;
            video_el.width = stream.getTracks()[0].getSettings().width;
            video_el.height = stream.getTracks()[0].getSettings().height;
            video_el.srcObject=stream;
            },
        (error)=>console.log('got media error:', error)
    );
}

function send_picture_and_wait_for_response() {
    let ws = new WebSocket("wss://wellread.ebdrup.biosustain.dtu.dk/ws");
    //let ws = new WebSocket("ws://localhost:8765");
    ws.onopen = () => {
        canvas_el.toBlob((blob) => ws.send(blob));
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
            img.onload = () => {
                canvas.clear();
                let faim = new fabric.Image(img);
                canvas.add(faim);
            };
            img.src = imageUrl;
        }
    }
}

function do_state_change(direction) {
    if (direction === -1) {
        if (program_state>0) {
            program_state--; // go back
        }
    } else if (direction === 1) {
        if (program_state<2) {
            program_state++; // go forward
        } else {
            program_state = 0; // reset
        }
    }
    console.log("state switch");
    console.log(program_state);
    switch (program_state) {
        case 0:
            if (window.canvas) {
                canvas.dispose();
            }
            // activate camera
            canvas_el.hidden = true;
            video_el.hidden = false;
            start_camera();
            // set button text
            back_button.innerText = "< (1/3)";
            fwd_button.innerText = "Take photo (2/3)>";
            break;
        case 1:
            video_el.hidden = true;
            canvas_el.hidden = false;
            // size the canvas to video size
            console.log("setting canvas to");
            console.log(video_el.videoWidth);
            console.log(video_el.videoHeight);
            canvas_el.width = video_el.videoWidth;
            canvas_el.height = video_el.videoHeight;
            // let fabric control the canvas
            window.canvas = new fabric.Canvas('canvas_id', {selection: false,});
            canvas.on('object:selected', function(o){
                let activeObj = o.target;
                if (activeObj.get('type') == 'group') {
                    activeObj.set({'borderColor':'#ff0000','cornerColor':'#fbb802'});
                }
            });
            let webcam = new fabric.Image(video_el, {selectable: false});
            let a3 = "";
            webcam.cloneAsImage((cloned) => a3 = cloned);
            a3.set('selectable', false);
            canvas.add(a3);
            window.webcam = webcam;
            window.a3 = a3;
            //stop camera
            video_el.srcObject.getTracks().forEach((track) => track.stop());
            //draw grid
            draw_grid();
            // set button text
            back_button.innerText = "< (1/3) Take another photo";
            fwd_button.innerText = "Analyze barcodes (3/3) >";
            break;
        case 2:
            // send data
            send_picture_and_wait_for_response();
            // receive data
            // handle data
            // set button text
            back_button.innerText = "< (2/3) Change grid";
            fwd_button.innerText = "Back to start (1/3) >";
            break;
    }
}

back_button.addEventListener('click', () => do_state_change(-1));
fwd_button.addEventListener('click', () => do_state_change(1));
do_state_change(0);