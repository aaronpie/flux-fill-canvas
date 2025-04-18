let BRUSH_RADIUS = 20;
let scale = 1;
let originalImage = null;
let imageNode = null;
let isDrawing = false;
// Added variables for zoom functionality
let zoomScale = 1;
let lastCenter = null;
let lastDist = 0;

function initializeEditor(config) {
    const imageData = config.images;
    const webhookUrl = config.webhookUrl;
    const pageId = config.pageId;

    // Initialize stage with minimum dimensions
    let stage = new Konva.Stage({
        container: 'container',
        width: 100,
        height: 100
    });

    const layer = new Konva.Layer();
    const maskLayer = new Konva.Layer();
    stage.add(layer);
    stage.add(maskLayer);
    maskLayer.visible(false);

    // Initialize UI elements
    const stepsSlider = document.getElementById('stepsSlider');
    const stepsValue = document.getElementById('stepsValue');
    const guidanceSlider = document.getElementById('guidanceSlider');
    const guidanceValue = document.getElementById('guidanceValue');

    // Update values display for sliders
    stepsSlider.addEventListener('input', function(e) {
        stepsValue.textContent = e.target.value;
    });

    guidanceSlider.addEventListener('input', function(e) {
        guidanceValue.textContent = parseFloat(e.target.value).toFixed(1);
    });

    // REMOVED: Mouse wheel for brush size
    // ADDED: Mouse wheel for zoom in/out relative to pointer
    stage.container().addEventListener('wheel', function(e) {
        e.preventDefault();
        
        // Get pointer position
        const pointer = stage.getPointerPosition();
        
        // If there's no image loaded, don't do anything
        if (!imageNode) return;
        
        // Calculate new scale
        const oldScale = layer.scaleX();
        
        // Zoom factor (adjust as needed)
        const scaleBy = 1.1;
        const newScale = e.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        
        // Limit zoom range 
        const minScale = 0.1;
        const maxScale = 5;
        if (newScale < minScale || newScale > maxScale) return;
        
        // Calculate new position
        const mousePointTo = {
            x: (pointer.x - layer.x()) / oldScale,
            y: (pointer.y - layer.y()) / oldScale,
        };
        
        // Update scale for all layers
        layer.scale({ x: newScale, y: newScale });
        maskLayer.scale({ x: newScale, y: newScale });
        
        // Update position to zoom relative to pointer
        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        
        layer.position(newPos);
        maskLayer.position(newPos);
        
        // Update global zoom scale for brush size calculations
        zoomScale = newScale;
        
        // Update layers
        layer.batchDraw();
        maskLayer.batchDraw();
        
        // Update cursor size based on zoom
        updateCursorSize();
        
        // Show zoom level indicator
        const zoomIndicator = document.createElement('div');
        zoomIndicator.style.cssText = `
            position: fixed;
            left: ${e.clientX + 20}px;
            top: ${e.clientY}px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            z-index: 1000;
        `;
        zoomIndicator.textContent = `Zoom: ${(newScale * 100).toFixed(0)}%`;
        document.body.appendChild(zoomIndicator);
        
        setTimeout(() => {
            zoomIndicator.remove();
        }, 1000);
    });

    // Populate dropdown
    const imageSelector = document.getElementById('imageSelector');
    imageData.forEach(img => {
        const option = document.createElement('option');
        option.value = img.url;
        option.textContent = img.title;
        imageSelector.appendChild(option);
    });

    // Create cursor element
    const cursor = document.getElementById('cursor');
    updateCursorSize();

    // Brush size slider
    const brushSlider = document.getElementById('brushSize');
    const brushSizeValue = document.getElementById('brushSizeValue');
    
    brushSlider.addEventListener('input', function(e) {
        BRUSH_RADIUS = parseInt(e.target.value);
        brushSizeValue.textContent = BRUSH_RADIUS + 'px';
        updateCursorSize();
    });

    // MODIFIED: Update cursor size to account for zoom
    function updateCursorSize() {
        cursor.style.width = (BRUSH_RADIUS * 2 * scale * zoomScale) + 'px';
        cursor.style.height = (BRUSH_RADIUS * 2 * scale * zoomScale) + 'px';
        cursor.style.marginLeft = -(BRUSH_RADIUS * scale * zoomScale) + 'px';
        cursor.style.marginTop = -(BRUSH_RADIUS * scale * zoomScale) + 'px';
    }

    function initializeMaskLayer(width, height) {
        maskLayer.destroyChildren();
        const background = new Konva.Rect({
            x: 0,
            y: 0,
            width: width,
            height: height,
            fill: 'black'
        });
        maskLayer.add(background);
        maskLayer.draw();
    }

    // File input handler
    document.getElementById('fileInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                loadImage(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    // Image selector handling
    imageSelector.addEventListener('change', function(e) {
        const selectedValue = e.target.value;
        
        if (selectedValue === 'local') {
            document.getElementById('fileInput').click();
            imageSelector.value = '';
            return;
        }

        if (!selectedValue) return;

        loadImage(selectedValue);
    });

    function loadImage(src) {
        const img = new Image();
        if (src.startsWith('data:')) {
            img.onload = handleImageLoad;
            img.src = src;
        } else {
            img.crossOrigin = 'anonymous';
            img.onload = handleImageLoad;
            img.onerror = function() {
                console.error('Error loading image');
                alert('Error loading image. The URL might have expired.');
            };
            img.src = src;
        }

        function handleImageLoad() {
            if (imageNode) {
                imageNode.destroy();
            }

            // Reset zoom when loading a new image
            zoomScale = 1;
            layer.scale({ x: 1, y: 1 });
            maskLayer.scale({ x: 1, y: 1 });
            layer.position({ x: 0, y: 0 });
            maskLayer.position({ x: 0, y: 0 });

            originalImage = img;
            const imgWidth = img.width;
            const imgHeight = img.height;
            const maxWidth = 1200;
            const maxHeight = 650;

            scale = 1;
            if (imgWidth > maxWidth || imgHeight > maxHeight) {
                scale = Math.min(
                    maxWidth / imgWidth,
                    maxHeight / imgHeight
                );
            }

            const displayWidth = Math.round(imgWidth * scale);
            const displayHeight = Math.round(imgHeight * scale);

            stage.width(displayWidth);
            stage.height(displayHeight);

            imageNode = new Konva.Image({
                x: 0,
                y: 0,
                image: img,
                width: displayWidth,
                height: displayHeight
            });

            layer.destroyChildren();
            layer.add(imageNode);
            layer.draw();

            initializeMaskLayer(displayWidth, displayHeight);
            updateCursorSize();

            document.getElementById('imageInfo').innerHTML = 
                `Original image: ${imgWidth}×${imgHeight}px<br>` +
                `Display size: ${displayWidth}×${displayHeight}px` +
                (scale !== 1 ? `<br>Scale: ${scale.toFixed(2)}` : '');
        }
    }

    // Clear button handling
    document.getElementById('clearButton').addEventListener('click', function() {
        if (imageNode) {
            layer.destroyChildren();
            maskLayer.destroyChildren();
            layer.draw();
            maskLayer.draw();
            stage.width(100);
            stage.height(100);
            document.getElementById('imageInfo').innerHTML = '';
            originalImage = null;
            imageSelector.value = '';
            
            // Reset zoom
            zoomScale = 1;
            layer.scale({ x: 1, y: 1 });
            maskLayer.scale({ x: 1, y: 1 });
            layer.position({ x: 0, y: 0 });
            maskLayer.position({ x: 0, y: 0 });
        }
    });

    // ADDED: Reset zoom button
    const resetZoomButton = document.createElement('button');
    resetZoomButton.id = 'resetZoomButton';
    resetZoomButton.textContent = 'Reset Zoom';
    resetZoomButton.className = 'btn btn-secondary';
    resetZoomButton.style.marginLeft = '10px';
    
    // Insert after clear button
    const clearButton = document.getElementById('clearButton');
    clearButton.parentNode.insertBefore(resetZoomButton, clearButton.nextSibling);
    
    resetZoomButton.addEventListener('click', function() {
        if (imageNode) {
            zoomScale = 1;
            layer.scale({ x: 1, y: 1 });
            maskLayer.scale({ x: 1, y: 1 });
            layer.position({ x: 0, y: 0 });
            maskLayer.position({ x: 0, y: 0 });
            layer.batchDraw();
            maskLayer.batchDraw();
            updateCursorSize();
        }
    });

    // Send button handling
    document.getElementById('sendButton').addEventListener('click', async function() {
        if (!imageNode || !originalImage) {
            alert('Please select an image first');
            return;
        }

        const sendButton = document.getElementById('sendButton');
        const loadingIndicator = document.getElementById('loadingIndicator');
        
        sendButton.disabled = true;
        loadingIndicator.style.display = 'inline';

        // Get original image as base64
        const originalCanvas = document.createElement('canvas');
        originalCanvas.width = originalImage.width;
        originalCanvas.height = originalImage.height;
        const originalCtx = originalCanvas.getContext('2d');
        originalCtx.drawImage(originalImage, 0, 0);
        const originalBase64 = originalCanvas.toDataURL('image/png');

        // Get mask as base64
        maskLayer.visible(true);
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = originalImage.width;
        maskCanvas.height = originalImage.height;
        const maskCtx = maskCanvas.getContext('2d');
        
        // MODIFIED: Save current state
        const currentScale = maskLayer.scaleX();
        const currentPosition = maskLayer.position();
        
        // Reset to original scale and position for export
        maskLayer.scale({ x: 1, y: 1 });
        maskLayer.position({ x: 0, y: 0 });
        
        const tempCanvas = maskLayer.toCanvas();
        maskCtx.drawImage(
            tempCanvas,
            0, 0, tempCanvas.width, tempCanvas.height,
            0, 0, originalImage.width, originalImage.height
        );
        const maskBase64 = maskCanvas.toDataURL('image/png');
        
        // Restore scale and position
        maskLayer.scale({ x: currentScale, y: currentScale });
        maskLayer.position(currentPosition);
        maskLayer.visible(false);

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: originalBase64,
                    mask: maskBase64,
                    prompt: document.getElementById('promptInput').value.trim(),
                    prompt_upsampling: document.getElementById('improvePrompt').checked,
                    steps: parseInt(document.getElementById('stepsSlider').value),
                    guidance: parseFloat(document.getElementById('guidanceSlider').value),
                    id: pageId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const modal = document.getElementById('resultModal');
            const resultImage = document.getElementById('resultImage');
            const originalImage = document.getElementById('originalImage');
            const slider = modal.querySelector('.slider');
            const container = modal.querySelector('.comparison-container');

            // Set up images
            originalImage.src = originalCanvas.toDataURL('image/png');
            resultImage.src = blobUrl;
          
            // Set initial slider position
            container.style.setProperty('--position', '15%');
            slider.value = 15;

            // Show modal when both images are loaded
            Promise.all([
                new Promise(resolve => originalImage.onload = resolve),
                new Promise(resolve => resultImage.onload = resolve)
            ]).then(() => {
                modal.style.display = 'block';
            });

            // Set up slider
            slider.addEventListener('input', (e) => {
                container.style.setProperty('--position', `${e.target.value}%`);
            });

            // Re-use button handler
            document.getElementById('reuseButton').onclick = function() {
                loadImage(blobUrl);
                modal.style.display = 'none';
            };

            // Save button handler
            document.getElementById('saveButton').onclick = function() {
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = 'generated-image.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            // Close button handler
            document.getElementById('closeButton').onclick = function() {
                modal.style.display = 'none';
                URL.revokeObjectURL(blobUrl);
            };

            // Close on Escape key
            window.addEventListener('keydown', function(event) {
                if (event.key === 'Escape' && modal.style.display === 'block') {
                    modal.style.display = 'none';
                    URL.revokeObjectURL(blobUrl);
                }
            });

        } catch (error) {
            console.error('Error:', error);
            alert('Error sending image: ' + error.message);
        } finally {
            sendButton.disabled = false;
            loadingIndicator.style.display = 'none';
        }
    });

    // MODIFIED: Mouse events for drawing to account for zoom
    stage.on('mousemove', function(e) {
        cursor.style.display = 'block';
        cursor.style.left = (e.evt.clientX + window.scrollX) + 'px';
        cursor.style.top = (e.evt.clientY + window.scrollY) + 'px';

        if (isDrawing && imageNode) {
            const pos = stage.getPointerPosition();
            
            // Calculate real position based on layer scale and position
            const layerPos = layer.position();
            const layerScale = layer.scaleX();
            
            const realX = (pos.x - layerPos.x) / layerScale;
            const realY = (pos.y - layerPos.y) / layerScale;
            
            // Draw white circle on mask layer
            const maskCircle = new Konva.Circle({
                x: realX,
                y: realY,
                radius: BRUSH_RADIUS * scale,
                fill: 'white'
            });
            maskLayer.add(maskCircle);
            maskLayer.batchDraw();

            // Create visual eraser effect
            const visualCircle = new Konva.Circle({
                x: realX,
                y: realY,
                radius: BRUSH_RADIUS * scale,
                fill: 'black',
                globalCompositeOperation: 'destination-out'
            });
            layer.add(visualCircle);
            layer.batchDraw();
        }
    });

    stage.on('mouseout', function() {
        cursor.style.display = 'none';
    });

    stage.on('mousedown', function() {
        isDrawing = true;
    });

    stage.on('mouseup', function() {
        isDrawing = false;
    });

    // MODIFIED: Touch events to account for zoom
    stage.on('touchstart', function(e) {
        isDrawing = true;
        const pos = stage.getPointerPosition();
        if (imageNode) {
            // Calculate real position based on layer scale and position
            const layerPos = layer.position();
            const layerScale = layer.scaleX();
            
            const realX = (pos.x - layerPos.x) / layerScale;
            const realY = (pos.y - layerPos.y) / layerScale;
            
            const maskCircle = new Konva.Circle({
                x: realX,
                y: realY,
                radius: BRUSH_RADIUS * scale,
                fill: 'white'
            });
            maskLayer.add(maskCircle);
            maskLayer.batchDraw();

            const visualCircle = new Konva.Circle({
                x: realX,
                y: realY,
                radius: BRUSH_RADIUS * scale,
                fill: 'black',
                globalCompositeOperation: 'destination-out'
            });
            layer.add(visualCircle);
            layer.batchDraw();
        }
    });

    stage.on('touchend', function() {
        isDrawing = false;
    });

    stage.on('touchmove', function(e) {
        if (isDrawing && imageNode) {
            const pos = stage.getPointerPosition();
            
            // Calculate real position based on layer scale and position
            const layerPos = layer.position();
            const layerScale = layer.scaleX();
            
            const realX = (pos.x - layerPos.x) / layerScale;
            const realY = (pos.y - layerPos.y) / layerScale;
            
            const maskCircle = new Konva.Circle({
                x: realX,
                y: realY,
                radius: BRUSH_RADIUS * scale,
                fill: 'white'
            });
            maskLayer.add(maskCircle);
            maskLayer.batchDraw();

            const visualCircle = new Konva.Circle({
                x: realX,
                y: realY,
                radius: BRUSH_RADIUS * scale,
                fill: 'black',
                globalCompositeOperation: 'destination-out'
            });
            layer.add(visualCircle);
            layer.batchDraw();
        }
    });
    
    // ADDED: Pinch zoom for mobile devices
    let lastDist = 0;
    let startScale = 1;
    
    stage.on('touchmove', function(e) {
        e.evt.preventDefault();
        
        if (imageNode && e.evt.touches.length === 2) {
            const touch1 = e.evt.touches[0];
            const touch2 = e.evt.touches[1];
            
            // Find center point between the two touches
            const center = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2,
            };
            
            // Calculate the distance between fingers
            const dist = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) + 
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            // If this is the first movement with two fingers
            if (!lastDist) {
                lastDist = dist;
                startScale = layer.scaleX();
                lastCenter = center;
                return;
            }
            
            // Calculate new scale
            const scale = startScale * (dist / lastDist);
            
            // Limit zoom range
            const minScale = 0.1;
            const maxScale = 5;
            if (scale < minScale || scale > maxScale) return;
            
            // Get stage position
            const stageBox = stage.container().getBoundingClientRect();
            const stagePos = {
                x: center.x - stageBox.left,
                y: center.y - stageBox.top,
            };
            
            // Calculate new position to zoom into center point
            const oldScale = layer.scaleX();
            const newScale = scale;
            
            const mousePointTo = {
                x: (stagePos.x - layer.x()) / oldScale,
                y: (stagePos.y - layer.y()) / oldScale,
            };
            
            const newPos = {
                x: stagePos.x - mousePointTo.x * newScale,
                y: stagePos.y - mousePointTo.y * newScale,
            };
            
            // Update layers
            layer.scale({ x: newScale, y: newScale });
            maskLayer.scale({ x: newScale, y: newScale });
            layer.position(newPos);
            maskLayer.position(newPos);
            
            // Update zoom scale
            zoomScale = newScale;
            
            // Update cursor size
            updateCursorSize();
            
            // Update stage
            layer.batchDraw();
            maskLayer.batchDraw();
        }
    });
    
    stage.on('touchend', function() {
        lastDist = 0;
    });
}