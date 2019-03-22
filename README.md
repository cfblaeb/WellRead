# WellRead
Locate and read datamatrix 2d barcodes in 96 well format

## Status
Under development  
todo:
    * speed up
   
## Parts:
    * NGINX
        * Serves static html+javascript frontend
        * Runs a 3 process front-end
            1) Activate webcam and let user take a photo of plate
            2) Let user adjust a grid to identify wells
            3) Send that image+grid to server and receive back results
    * Python
        * Runs a Websockets based host that accepts a websocket connection
            1) Receive image+grid data
            2) Analyse using libdmtx
            3) Return image with color coded per well fail/success plus barcodes 
