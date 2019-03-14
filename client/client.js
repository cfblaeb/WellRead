// dom element shortcuts
let video_el = document.getElementById('video_id');
let canvas_el = document.getElementById('canvas_id');
let fullres_canvas = document.getElementById("fullres_canvas_id");
let video_source_selector = document.getElementById('video_source_select');
let back_button = document.getElementById('back_btn');
let fwd_button = document.getElementById('fwd_btn');
let result_table = document.getElementById('result_table');

let program_state = 0;
/*
    0: Taking a picture of the plate
        camera          on, hidden
        canvas          show camera
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

function draw_grid () {
    // plate dimensions
    let no_rows = 0;
    let no_columns = 0;

    if (canvas.width>canvas.height) { // landscape
        no_rows = 8;
        no_columns = 12;
    } else { // portrait
        no_rows = 12;
        no_columns = 8;
    }
    let square_size = Math.min(canvas.height/no_rows, canvas.width/no_columns)*0.8;

    let lines = [];
    for (let row = 1; row<no_rows; row++ ) {
        lines.push(new fabric.Line([ square_size, row*square_size+square_size, no_columns*square_size+square_size, row*square_size+square_size], {stroke: '#FF0000'}))
    }
    for (let column = 1; column<no_columns; column++ ) {
        lines.push(new fabric.Line([ column*square_size+square_size, square_size, column*square_size+square_size, no_rows*square_size+square_size], {stroke: '#FF0000'}))
    }
    window.pl = new fabric.Group(lines);
    window.canvas.add(window.pl);
}

// function to update the canvas
function render() {
    if (program_state===0) {
        canvas.renderAll();
        fabric.util.requestAnimFrame(render);
    }
}

function start_camera() {
    if (program_state===0) {
        if (video_el.srcObject) {video_el.srcObject.getTracks().forEach(function(track) {track.stop();});}
        navigator.mediaDevices.getUserMedia({
        video: {
            width: 1920,
            height: 1080,
            deviceId: {exact: video_source_selector.value}
        },
        }).then(
            (stream)=> {
                video_el.onplay = () => {
                    // add widht+height tag to video el. Needed for fabricjs
                    video_el.width = video_el.videoWidth;
                    video_el.height = video_el.videoHeight;
                    // if a canvas object already exist, delete it
                    if (window.canvas) {
                        window.canvas.dispose();
                    }
                    // size the canvas
                    window.browser_width = document.documentElement.clientWidth - 150; // extra to get some space
                    let webcam_width = video_el.videoWidth;
                    let scale = webcam_width/window.browser_width;

                    canvas_el.width = window.browser_width;
                    canvas_el.height = video_el.videoHeight/scale;
                    // let fabric control the canvas
                    window.canvas = new fabric.Canvas('canvas_id', {selection: false,});
                    window.canvas.on('object:selected', function(o){
                        let activeObj = o.target;
                        if (activeObj.get('type') === 'group') {
                            activeObj.set({'borderColor':'#ff0000','cornerColor':'#fbb802'});
                        }
                    });
                    window.webcam = new fabric.Image(video_el, {selectable: false});
                    window.webcam.scaleToWidth(window.browser_width);
                    window.canvas.add(window.webcam);
                    fabric.util.requestAnimFrame(
                        render
                    );
                };

                video_el.srcObject=stream;
                },
            (error)=>console.log('got media error:', error)
        );
    }
}

function send_picture_and_wait_for_response(image) {
    let ws = new WebSocket("wss://wellread.ebdrup.biosustain.dtu.dk/ws");
    //let ws = new WebSocket("ws://localhost:8765");
    ws.onopen = () => {
        ws.send(window.full_res_blob);
        //send grid info
        ws.send(JSON.stringify(window.pl));
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
                window.canvas.clear();
                fabric.Image(img, (e) => {
                    e.scaleToWidth(window.browser_width);
                    window.canvas.add(e)
                });
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
    switch (program_state) {
        case 0:
            if (direction !== 0) { // we came from either 1 or 2
                window.canvas.clear();
            }

            start_camera(); // activate camera
            // set button text
            video_source_selector.disabled = false;
            back_button.innerText = "<";
            back_button.disabled = true;
            fwd_button.innerText = "Take photo >";
            break;
        case 1:
            window.canvas.clear();
            //create full res canvas copy of video
            if (direction === 1) { // if we came from state 0 then save a new full res video screenshot
                fullres_canvas.width = video_el.videoWidth;
                fullres_canvas.height = video_el.videoHeight;
                fullres_canvas.getContext('2d').drawImage(video_el, 0, 0);
                fullres_canvas.toBlob((blob) => window.full_res_blob = blob); // store a full_res blob for server
                //stop camera
                video_el.srcObject.getTracks().forEach((track) => track.stop());
            }
            fabric.Image.fromURL(fullres_canvas.toDataURL(), (e) => {
                e.set('selectable', false);
                e.scaleToWidth(window.browser_width);
                window.canvas.add(e);
                draw_grid();
            });

            // set button text
            video_source_selector.disabled = true;
            back_button.disabled = false;
            back_button.innerText = "< Retake photo";
            fwd_button.innerText = "Analyze barcodes >";
            break;
        case 2:
            // send data
            send_picture_and_wait_for_response();
            // receive data
            // handle data
            // set button text
            back_button.innerText = "< Change grid";
            fwd_button.innerText = "Restart >";
            break;
    }
}

back_button.addEventListener('click', () => do_state_change(-1));
fwd_button.addEventListener('click', () => do_state_change(1));

// list cameras
navigator.mediaDevices.enumerateDevices().then(
    (devices) => {
        devices.forEach((device, i) => {
            if (device.kind === 'videoinput') {
                let device_option = document.createElement("option");
                device_option.value = device.deviceId;
                device_option.text = device.label || "camera " + i;
                video_source_selector.add(device_option)
            }
        });
        do_state_change(0); // start the whole thing
        video_source_selector.onchange=start_camera;
    });