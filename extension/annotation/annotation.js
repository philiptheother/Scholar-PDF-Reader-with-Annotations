let currentColor = 'magenta';
let pdfUrl = '';
let mouseX = 0;
let mouseY = 0;

let isDrawing = false;
let currentPath = [];
let drawingCanvas = null;
let drawingCtx = null;

let activeCommentPopup = null;
let commentPreviewTimeout = null;

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

// Constants and utilities
const TOOLS = {
    highlight: {
        id: 'highlight-btn',
        colors: ['yellow', 'greenyellow', 'cyan', 'magenta', 'red']
    },
    draw: {
        id: 'draw-btn',
        colors: ['white', 'black', 'red', 'green', '#4374E0']
    },
    text: {
        id: 'text-btn',
        colors: ['white', 'black', 'red', 'green', 'blue']
    },
    comment: {
        id: 'comment-btn',
        colors: ['blue', 'green', 'orange', 'purple', 'red'],
    }
};

class ColorPickerManager {
    constructor() {
        this.activeTools = {
            isHighlighting: false,
            isDrawing: false,
            isTexting: false,
            isCommenting: false,
            isErasing: false
        };
        this.currentColors = {
            highlight: TOOLS.highlight.colors[3],
            draw: TOOLS.draw.colors[4],
            text: TOOLS.text.colors[1],
            comment: TOOLS.comment.colors[0]
        };
        
        // Custom colors for each tool
        this.customColors = {
            highlight: 'magenta',       // Default custom color - magenta
            // highlight: '#FF4500',    // Default custom color - orange red
            draw: '#4374E0',            // Default custom color - royal blue
            // draw: '#8A2BE2',         // Default custom color - blue violet
            text: '#4374E0',            // Default custom color - royal blue
            // text: '#20B2AA',         // Default custom color - light sea green
            comment: '#4374E0',         // Default custom color - royal blue
            // comment: '#4374E0'       // Default custom color - royal blue
        };
        
        // Current HSV values for each tool
        this.hsvValues = {
            highlight: { h: 16, s: 100, v: 100 },  // Orange-red
            draw: { h: 271, s: 76, v: 74 },        // Blue-violet
            text: { h: 174, s: 81, v: 70 },         // Light sea green
            comment: { h: 220, s: 70, v: 88 }      // Blue for comments
        };
        
        // Flags for the color picker drag operations
        this.isDraggingHue = false;
        this.isDraggingSV = false;
        this.activePickerTool = null;
        
        // Add history stacks for undo/redo
        this.undoStack = [];
        this.redoStack = [];
        
        // Add global event listeners for drag operations
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Set up keyboard shortcuts
        this.setupKeyboardShortcuts();
    }
    
    // Convert HSV to RGB
    hsvToRgb(h, s, v) {
        s = s / 100;
        v = v / 100;
        
        let r, g, b;
        const i = Math.floor(h / 60);
        const f = h / 60 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }
    
    // Convert RGB to Hex
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(c => {
            const hex = c.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
    
    // Convert Hex to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    // Convert RGB to HSV
    rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, v = max;
        
        const d = max - min;
        s = max === 0 ? 0 : d / max;
        
        if (max === min) {
            h = 0; // achromatic
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            v: Math.round(v * 100)
        };
    }
    
    // Handle mouse move for dragging operations
    handleMouseMove(e) {
        if (!this.isDraggingHue && !this.isDraggingSV || !this.activePickerTool) return;
        
        const toolType = this.activePickerTool;
        const picker = document.getElementById(`${toolType}-color-picker`);
        
        if (this.isDraggingHue) {
            const hueSlider = picker.querySelector('.hue-slider');
            const rect = hueSlider.getBoundingClientRect();
            let x = e.clientX - rect.left;
            
            // Constrain to the slider width
            x = Math.max(0, Math.min(rect.width, x));
            
            // Calculate hue value (0-360)
            const hue = Math.round((x / rect.width) * 360);
            this.hsvValues[toolType].h = hue;
            
            // Update the hue slider handle position
            const handle = hueSlider.querySelector('.hue-slider-handle');
            handle.style.left = `${x}px`;
            
            // Update the saturation-value picker background color
            const svPicker = picker.querySelector('.saturation-value-picker');
            const hueColor = this.rgbToHex(
                ...Object.values(this.hsvToRgb(hue, 100, 100))
            );
            svPicker.style.backgroundColor = hueColor;
            
            this.updateColorFromHsv(toolType);
        }
        
        if (this.isDraggingSV) {
            const svPicker = picker.querySelector('.saturation-value-picker');
            const rect = svPicker.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            
            // Constrain to the picker area
            x = Math.max(0, Math.min(rect.width, x));
            y = Math.max(0, Math.min(rect.height, y));
            
            // Calculate saturation and value
            const s = Math.round((x / rect.width) * 100);
            const v = Math.round(100 - (y / rect.height) * 100);
            
            this.hsvValues[toolType].s = s;
            this.hsvValues[toolType].v = v;
            
            // Update the handle position
            const handle = svPicker.querySelector('.picker-handle');
            handle.style.left = `${x}px`;
            handle.style.top = `${y}px`;
            
            this.updateColorFromHsv(toolType);
        }
    }
    
    // Handle mouse up to end drag operations
    handleMouseUp() {
        this.isDraggingHue = false;
        this.isDraggingSV = false;
    }
    
    // Update color based on current HSV values
    updateColorFromHsv(toolType) {
        const hsv = this.hsvValues[toolType];
        const rgb = this.hsvToRgb(hsv.h, hsv.s, hsv.v);
        const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
        
        // Update the custom color
        this.customColors[toolType] = hex;
        
        // Update the picker UI
        const picker = document.getElementById(`${toolType}-color-picker`);
        const preview = picker.querySelector('.color-preview');
        const hexInput = picker.querySelector('.hex-input');
        const customButton = document.querySelector(`#${toolType}-color-popup .custom-color`);
        
        preview.style.backgroundColor = hex;
        hexInput.value = hex;
        customButton.style.backgroundColor = hex;
        
        // Always update the current color to the new custom color
        this.currentColors[toolType] = hex;
        
        // Update the tool button shadow
        const button = document.getElementById(TOOLS[toolType].id);
        button.style.textShadow = `0 0 10px ${hex}`;
        
        // Update active state in the color popup
        this.updateActiveColor(toolType, customButton);
    }
    
    // Create the custom color picker UI
    createColorPicker(toolType) {
        const colors = TOOLS[toolType].colors;
        const popup = document.createElement('div');
        popup.id = `${toolType}-color-popup`;
        popup.className = 'color-popup';
        
        // Add custom color button at the top
        const customButton = document.createElement('button');
        customButton.className = 'color-option custom-color';
        customButton.setAttribute('data-color', 'custom');
        customButton.title = "Custom color";
        
        // Set the button's background to the current custom color for this tool
        customButton.style.backgroundColor = this.customColors[toolType];
        
        // Create custom color picker
        const picker = document.createElement('div');
        picker.className = 'custom-color-picker';
        picker.id = `${toolType}-color-picker`;
        
        // Hue slider
        const hueSlider = document.createElement('div');
        hueSlider.className = 'hue-slider';
        const hueHandle = document.createElement('div');
        hueHandle.className = 'hue-slider-handle';
        hueSlider.appendChild(hueHandle);
        
        // Saturation/Value picker
        const svPicker = document.createElement('div');
        svPicker.className = 'saturation-value-picker';
        const whiteGradient = document.createElement('div');
        whiteGradient.className = 'white-gradient';
        const blackGradient = document.createElement('div');
        blackGradient.className = 'black-gradient';
        const svHandle = document.createElement('div');
        svHandle.className = 'picker-handle';
        svPicker.appendChild(whiteGradient);
        svPicker.appendChild(blackGradient);
        svPicker.appendChild(svHandle);
        
        // Color preview
        const preview = document.createElement('div');
        preview.className = 'color-preview';
        
        // Hex input
        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'hex-input';
        hexInput.maxLength = 7;
        hexInput.placeholder = '#RRGGBB';
        
        // Add all elements to the picker
        picker.appendChild(hueSlider);
        picker.appendChild(svPicker);
        picker.appendChild(preview);
        picker.appendChild(hexInput);
        
        // Initialize picker UI based on current color
        const hsv = this.hsvValues[toolType];
        const rgb = this.hsvToRgb(hsv.h, hsv.s, hsv.v);
        const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
        
        // Set initial positions and colors
        const huePos = (hsv.h / 360) * 100;
        hueHandle.style.left = `${huePos}%`;
        
        svPicker.style.backgroundColor = this.rgbToHex(
            ...Object.values(this.hsvToRgb(hsv.h, 100, 100))
        );
        
        svHandle.style.left = `${hsv.s}%`;
        svHandle.style.top = `${100 - hsv.v}%`;
        
        preview.style.backgroundColor = hex;
        hexInput.value = hex;
        
        // Add event listeners for the picker
        hueSlider.addEventListener('mousedown', (e) => {
            this.isDraggingHue = true;
            this.activePickerTool = toolType;
            this.handleMouseMove(e);
        });
        
        svPicker.addEventListener('mousedown', (e) => {
            this.isDraggingSV = true;
            this.activePickerTool = toolType;
            this.handleMouseMove(e);
        });
        
        hexInput.addEventListener('input', (e) => {
            const newHex = e.target.value;
            if (/^#[0-9A-F]{6}$/i.test(newHex)) {
                const rgb = this.hexToRgb(newHex);
                if (rgb) {
                    const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
                    this.hsvValues[toolType] = hsv;
                    
                    // Update UI positions
                    const huePos = (hsv.h / 360) * 100;
                    hueHandle.style.left = `${huePos}%`;
                    
                    svPicker.style.backgroundColor = this.rgbToHex(
                        ...Object.values(this.hsvToRgb(hsv.h, 100, 100))
                    );
                    
                    svHandle.style.left = `${hsv.s}%`;
                    svHandle.style.top = `${100 - hsv.v}%`;
                    
                    preview.style.backgroundColor = newHex;
                    
                    // Use updateColorFromHsv to update everything consistently
                    this.updateColorFromHsv(toolType);
                }
            }
        });
        
        // Add the picker to the custom button
        customButton.appendChild(picker);
        popup.appendChild(customButton);
        
        // Add the predefined colors
        colors.forEach(color => {
            const button = document.createElement('button');
            button.className = 'color-option';
            button.setAttribute('data-color', color);
            button.style.backgroundColor = color;
            if (color === this.currentColors[toolType]) {
                button.classList.add('active');
            }
            popup.appendChild(button);
        });

        return popup;
    }

    setupToolButton(toolType) {
        const container = document.createElement('div');
        container.className = 'tool-container';
        
        const button = document.getElementById(TOOLS[toolType].id);
        const popup = this.createColorPicker(toolType);
        
        // Move the button into the container and add the popup
        button.parentNode.insertBefore(container, button);
        container.appendChild(button);
        container.appendChild(popup);
        
        // Initialize the button shadow right after creating it
        button.style.textShadow = `0 0 10px ${this.currentColors[toolType]}`;

        let hideTimeout;

        container.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
            popup.style.display = 'block';
        });

        container.addEventListener('mouseleave', () => {
            hideTimeout = setTimeout(() => {
                popup.style.display = 'none';
                
                // Hide all color pickers
                document.querySelectorAll('.custom-color-picker').forEach(picker => {
                    picker.style.display = 'none';
                });
            }, 100);
        });
        
        // Setup hover behavior for custom color button
        const customButton = popup.querySelector('.custom-color');
        const picker = customButton.querySelector('.custom-color-picker');
        
        customButton.addEventListener('mouseenter', () => {
            // Hide any other open pickers first
            document.querySelectorAll('.custom-color-picker').forEach(p => {
                p.style.display = 'none';
            });
            picker.style.display = 'block';
        });
        
        // Make clicking on the custom color button activate the color
        customButton.addEventListener('click', (e) => {
            // Only process clicks on the button itself, not the picker
            if (e.target === customButton) {
                this.currentColors[toolType] = this.customColors[toolType];
                this.updateActiveColor(toolType, customButton);
            }
            
            // Prevent event from bubbling
            e.stopPropagation();
        });
        
        // Handle regular color option clicks
        popup.querySelectorAll('.color-option:not(.custom-color)').forEach(option => {
            option.addEventListener('click', (e) => {
                this.currentColors[toolType] = e.target.getAttribute('data-color');
                this.updateActiveColor(toolType, e.target);
            });
        });

        return container;
    }

    updateActiveColor(toolType, activeOption) {
        const popup = document.getElementById(`${toolType}-color-popup`);
        popup.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
        });
        activeOption.classList.add('active');
        
        const button = document.getElementById(TOOLS[toolType].id);
        button.style.textShadow = `0 0 10px ${this.currentColors[toolType]}`;
        
        // Only try to activate implemented tools
        if (toolType === 'highlight' || toolType === 'draw' || toolType === 'text' || toolType === 'comment') {
            // Deactivate all other tools first
            Object.keys(this.activeTools).forEach(key => {
                this.activeTools[key] = false;
            });
            // Activate this tool
            this.activeTools[`is${toolType.charAt(0).toUpperCase() + toolType.slice(1)}ing`] = true;
            // Update all button states
            this.updateButtonStates();
            // Update cursor
            this.updateCursor({ target: document.elementFromPoint(mouseX, mouseY) });
        }
        else if (toolType === 'other') {
            // For unimplemented tools, show the alert but don't activate the tool
            alert('This feature is not implemented yet!');
        }
    }

    updateButtonStates() {
        Object.keys(TOOLS).forEach(tool => {
            const button = document.getElementById(TOOLS[tool].id);
            const isActive = this.activeTools[`is${tool.charAt(0).toUpperCase() + tool.slice(1)}ing`];
            button.classList.toggle('active', isActive);
        });
        
        const eraseBtn = document.getElementById('erase-btn');
        eraseBtn.classList.toggle('active', this.activeTools.isErasing);
    }

    updateCursor(event) {
        if (this.activeTools.isHighlighting) {
            document.body.style.cursor = 'crosshair';
        } else if (this.activeTools.isDrawing) {
            document.body.style.cursor = 'crosshair';
        } else if (this.activeTools.isTexting) {
            document.body.style.cursor = 'text';
        } else if (this.activeTools.isCommenting) {
            document.body.style.cursor = 'crosshair';
        } else if (this.activeTools.isErasing) {
            document.body.style.cursor = 'pointer';
        } else {
            const target = event.target;
            const isTextElement = target.nodeType === Node.TEXT_NODE ||
                (target.nodeType === Node.ELEMENT_NODE &&
                    ['P', 'SPAN', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'FIGCAPTION'].includes(target.tagName));
            document.body.style.cursor = isTextElement ? 'text' : 'default';
        }
    }
    
    // Set up keyboard shortcuts for tools and color cycling
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts if user is typing in an input field or contenteditable element
            if (e.target.tagName === 'INPUT' || 
                e.target.tagName === 'TEXTAREA' || 
                e.target.isContentEditable) {
                return;
            }
            
            // Check for Ctrl/Cmd + Z (Undo) and Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z (Redo)
            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 'z') {
                    if (e.shiftKey) {
                        // Ctrl/Cmd + Shift + Z for Redo
                        e.preventDefault();
                        this.redo();
                        return;
                    } else {
                        // Ctrl/Cmd + Z for Undo
                        e.preventDefault();
                        this.undo();
                        return;
                    }
                } else if (e.key.toLowerCase() === 'y') {
                    // Ctrl/Cmd + Y for Redo
                    e.preventDefault();
                    this.redo();
                    return;
                }
            }
            
            // Handle different shortcuts
            switch(e.key.toLowerCase()) {
                case 'h':
                    // Activate/deactivate highlight tool
                    this.activateTool('highlight');
                    break;
                    
                case 'd':
                    // Activate/deactivate draw tool
                    this.activateTool('draw');
                    break;
                    
                case 't':
                    // Activate/deactivate text tool
                    this.activateTool('text');
                    break;
                    
                case 'e':
                    // Activate/deactivate erase tool
                    this.activateTool('erase');
                    break;
                    
                case 'c':
                    // Activate/deactivate comment tool
                    this.activateTool('comment');
                    // Cycle to next color for the active tool
                    // this.cycleToNextColor();
                    break;
                
                case 'escape':
                    // Deactivate all tools
                    this.deactivateAllTools();
                    break;
                    
                // Color selection shortcuts (1-5)
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                    // Get the color index (0-4) from the key (1-5)
                    const colorIndex = parseInt(e.key) - 1;
                    this.setColorByIndex(colorIndex);
                    break;
            }
        });
    }
    
    // Deactivate all tools (for Escape key)
    deactivateAllTools() {
        let wasAnyToolActive = false;
        
        // Check if any tool was active
        Object.keys(this.activeTools).forEach(key => {
            if (this.activeTools[key]) {
                wasAnyToolActive = true;
            }
            this.activeTools[key] = false;
        });
        
        // Only update UI if we actually deactivated something
        if (wasAnyToolActive) {
            this.updateButtonStates();
            this.updateCursor({ target: document.elementFromPoint(mouseX, mouseY) });
        }
    }
    
    // Activate a specific tool (now handles all tools including eraser)
    activateTool(toolType) {
        // Determine the state key based on tool type
        let toolStateKey;
        if (toolType === 'erase') {
            toolStateKey = 'isErasing';
        } else {
            toolStateKey = `is${toolType.charAt(0).toUpperCase() + toolType.slice(1)}ing`;
        }
        
        // Check if this tool is already active - if so, deactivate it (toggle behavior) and return
        if (this.activeTools[toolStateKey]) {
            this.activeTools[toolStateKey] = false;
            if (toolType === 'comment') {
                // Close any active comment popup when deactivating comment tool
                this.closeCommentPopup();
            }
            this.updateButtonStates();
            this.updateCursor({ target: document.elementFromPoint(mouseX, mouseY) });
            return;
        }
        /* 
        // For unimplemented tools, show an alert
        if (toolType === 'other') {
            alert('This feature is not implemented yet!');
            return;
        }
        */
        // Reset all tool states
        Object.keys(this.activeTools).forEach(key => {
            this.activeTools[key] = false;
        });
        
        // Activate the requested tool
        this.activeTools[toolStateKey] = true;
        
        // Update UI
        this.updateButtonStates();
        this.updateCursor({ target: document.elementFromPoint(mouseX, mouseY) });
    }
    
    // Set color by index (for number key shortcuts 1-5)
    setColorByIndex(index) {
        // Determine which tool is active
        let activeTool = null;
        
        if (this.activeTools.isHighlighting) {
            activeTool = 'highlight';
        } else if (this.activeTools.isDrawing) {
            activeTool = 'draw';
        } else if (this.activeTools.isTexting) {
            activeTool = 'text';
        } else if (this.activeTools.isCommenting) {
            activeTool = 'comment';
        }
        
        // If no color tool is active, do nothing
        if (!activeTool) return;
        
        // Get colors for the active tool
        const colors = TOOLS[activeTool].colors;
        
        // Check if the index is valid
        if (index >= 0 && index < colors.length) {
            const newColor = colors[index];
            
            // Update current color
            this.currentColors[activeTool] = newColor;
            
            // Update UI
            const popup = document.getElementById(`${activeTool}-color-popup`);
            const colorOption = popup.querySelector(`.color-option[data-color="${newColor}"]`);
            
            // If we found the color option, update its active state
            if (colorOption) {
                this.updateActiveColor(activeTool, colorOption);
            }
        }
    }
    /* 
    // Cycle to the next color for the active tool
    cycleToNextColor() {
        // Determine which tool is active
        let activeTool = null;
        
        if (this.activeTools.isHighlighting) {
            activeTool = 'highlight';
        } else if (this.activeTools.isDrawing) {
            activeTool = 'draw';
        } else if (this.activeTools.isTexting) {
            activeTool = 'text';
        }
        
        // If no color tool is active, do nothing
        if (!activeTool) return;
        
        const colors = TOOLS[activeTool].colors;
        
        // Find the current color's index
        let currentIndex = -1;
        const currentColor = this.currentColors[activeTool];
        
        // Check if current color is a predefined color
        for (let i = 0; i < colors.length; i++) {
            if (colors[i] === currentColor) {
                currentIndex = i;
                break;
            }
        }
        
        // If using a custom color or the last predefined color, cycle to the first color
        // Otherwise, move to the next color
        const nextIndex = (currentIndex === -1 || currentIndex === colors.length - 1) ? 0 : currentIndex + 1;
        const nextColor = colors[nextIndex];
        
        // Update the current color
        this.currentColors[activeTool] = nextColor;
        
        // Update the UI
        const popup = document.getElementById(`${activeTool}-color-popup`);
        const colorOption = popup.querySelector(`.color-option[data-color="${nextColor}"]`);
        
        // If we found the color option, update its active state
        if (colorOption) {
            this.updateActiveColor(activeTool, colorOption);
        }
    }
    */
    // Add an action to the undo history
    addToHistory(action) {
        // Clear redo stack when a new action is performed
        this.redoStack = [];
        this.undoStack.push(action);
    }

    // Perform an undo operation
    undo() {
        if (this.undoStack.length === 0) return;
        
        const action = this.undoStack.pop();
        this.redoStack.push(action);
        
        console.log('Undoing action:', action);
        
        if (action.type === 'highlight_create') {
            // Undo a highlight action by removing the highlight
            this.removeHighlightById(action.groupId);
        }
        else if (action.type === 'highlight_erase') {
            // Undo an erase action by restoring the highlights
            this.restoreHighlights(action.highlightGroups);
        }
        else if (action.type === 'draw_create') {
            // Undo a draw by removing it
            removeDrawingById(action.drawingId);
        }
        else if (action.type === 'draw_erase') {
            // Undo an erase by restoring the drawing
            restoreDrawing(action.drawing);
        }
        else if (action.type === 'text_create') {
            // Undo create => remove it
            removeTextById(action.text.id, false); // don't push another history entry
        }
        else if (action.type === 'text_delete') {
            // Undo delete => restore it
            restoreText(action.text);
        }
        else if (action.type === 'text_edit') {
            // Undo edit => restore oldRecord
            restoreText(action.oldText);
            removeTextById(action.newText.id, false);
        }
        else if (action.type === 'comment_create') {
            this.removeCommentById(action.commentId);
        }
        else if (action.type === 'comment_delete') {
            this.recreateComment(action.comment);
        }
        else if (action.type === 'comment_edit') {
            this.updateCommentText(action.commentId, action.oldText);
        }
        else if (action.type === 'eraseAll') {
            // For unimplemented tools, show the alert but don't activate the tool
            alert('This feature is not implemented yet!');
        }
    }

    // Perform a redo operation
    redo() {
        if (this.redoStack.length === 0) return;
        
        const action = this.redoStack.pop();
        this.undoStack.push(action);
        
        console.log('Redoing action:', action);
        
        if (action.type === 'highlight_create') {
            // Redo a highlight action by recreating the highlight
            this.recreateHighlight(action);
        }
        else if (action.type === 'highlight_erase') {
            // Redo an erase action by removing the highlights again
            this.removeHighlightById(action.groupId);
        }
        else if (action.type === 'draw_create') {
            // Redo a draw by restoring it again
            restoreDrawing(action.drawing);
        }
        else if (action.type === 'draw_erase') {
            // Redo an erase by removing it again
            removeDrawingById(action.drawing.id || action.drawingId);
        }
        else if (action.type === 'text_create') {
            restoreText(action.text);
        }
        else if (action.type === 'text_delete') {
            removeTextById(action.text.id, false);
        }
        else if (action.type === 'text_edit') {
            restoreText(action.newText);
            removeTextById(action.oldText.id, false);
        }
        else if (action.type === 'comment_create') {
            this.recreateComment(action.comment);
        }
        else if (action.type === 'comment_delete') {
            this.removeCommentById(action.comment.id);
        }
        else if (action.type === 'comment_edit') {
            this.updateCommentText(action.commentId, action.newText);
        }
        else if (action.type === 'eraseAll') {
            // For unimplemented tools, show the alert but don't activate the tool
            alert('This feature is not implemented yet!');
        }
    }

    // Remove a highlight by its groupId
    removeHighlightById(groupId) {
        chrome.storage.local.get([pdfUrl], function (result) {
            if (chrome.runtime.lastError) {
                console.error('Error loading annotations:', chrome.runtime.lastError);
                return;
            }

            const savedAnnotations = result[pdfUrl] || [];
            const groupIndex = savedAnnotations.findIndex(group => group.id === groupId);
            
            if (groupIndex !== -1) {
                const group = savedAnnotations[groupIndex];
                
                // Remove highlight spans from DOM
                document.querySelectorAll(`[data-group-id="${groupId}"]`).forEach(span => {
                    const parent = span.parentNode;
                    const textContent = span.textContent;
                    const textNode = document.createTextNode(textContent);
                    parent.replaceChild(textNode, span);
                });
                
                // Remove from storage
                savedAnnotations.splice(groupIndex, 1);
                chrome.storage.local.set({ [pdfUrl]: savedAnnotations });
                
                // Normalize to combine adjacent text nodes
                document.body.normalize();
            }
        });
    }

    // Restore highlights that were previously erased
    restoreHighlights(highlightGroups) {
        chrome.storage.local.get([pdfUrl], function (result) {
            if (chrome.runtime.lastError) {
                console.error('Error loading annotations:', chrome.runtime.lastError);
                return;
            }

            const savedAnnotations = result[pdfUrl] || [];
            
            // Add all groups back to storage
            highlightGroups.forEach(group => {
                if (!savedAnnotations.some(existing => existing.id === group.id)) {
                    savedAnnotations.push(group);
                }
            });
            
            chrome.storage.local.set({ [pdfUrl]: savedAnnotations }, function() {
                // After saving, reapply the highlights to the page
                highlightGroups.forEach(group => {
                    const pageElements = document.querySelectorAll('.gsr-page');
                    pageElements.forEach(pageElement => {
                        const textContainer = pageElement.querySelector('.gsr-text-ctn');
                        if (textContainer) {
                            group.nodes.forEach(nodeInfo => {
                                const node = findNodeInPage(textContainer, nodeInfo.xpath, nodeInfo.text);
                                if (node) {
                                    highlightNode(node, nodeInfo.text, group.color || currentColor, group.id);
                                }
                            });
                        }
                    });
                });
            });
        });
    }

    // Recreate a highlight that was previously removed
    recreateHighlight(action) {
        chrome.storage.local.get([pdfUrl], function (result) {
            if (chrome.runtime.lastError) {
                console.error('Error loading annotations:', chrome.runtime.lastError);
                return;
            }

            const savedAnnotations = result[pdfUrl] || [];
            
            // Add the highlight group back to storage if it doesn't exist
            if (!savedAnnotations.some(group => group.id === action.groupId)) {
                savedAnnotations.push(action.highlightGroup);
                
                chrome.storage.local.set({ [pdfUrl]: savedAnnotations }, function() {
                    // After saving, reapply the highlight to the page
                    const group = action.highlightGroup;
                    const pageElements = document.querySelectorAll('.gsr-page');
                    
                    pageElements.forEach(pageElement => {
                        const textContainer = pageElement.querySelector('.gsr-text-ctn');
                        if (textContainer) {
                            group.nodes.forEach(nodeInfo => {
                                const node = findNodeInPage(textContainer, nodeInfo.xpath, nodeInfo.text);
                                if (node) {
                                    highlightNode(node, nodeInfo.text, group.color || currentColor, group.id);
                                }
                            });
                        }
                    });
                });
            }
        });
    }

    // Comment functionality methods
    showCommentModeMessage() {
        this.showMessage('Comment mode activated. Select text to add a comment.', 'info');
    }

    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#ffd700' : '#007bff'};
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 10001;
            font-size: 14px;
        `;
        messageEl.textContent = message;
        document.body.appendChild(messageEl);
        
        setTimeout(() => messageEl.remove(), 3000);
    }

    closeCommentPopup() {
        if (activeCommentPopup) {
            activeCommentPopup.remove();
            activeCommentPopup = null;
        }
        
        // Clear any text selection
        window.getSelection().removeAllRanges();
    }

    handleCommentSelection() {
        if (!this.activeTools.isCommenting) return;

        const selection = window.getSelection();
        if (selection.rangeCount === 0 || selection.isCollapsed) return;

        const selectedText = selection.toString().trim();
        if (selectedText.length < 3) {
            this.showMessage('Please select at least 3 characters', 'warning');
            selection.removeAllRanges();
            return;
        }

        if (selectedText.length > 500) {
            this.showMessage('Selection too long (max 500 characters)', 'warning');
            selection.removeAllRanges();
            return;
        }

        // Create comment popup
        const range = selection.getRangeAt(0);
        this.showCommentPopup(range, selectedText);
    }

    showCommentPopup(range, selectedText) {
        // Remove any existing popup
        this.closeCommentPopup();

        // Create popup element
        const popup = document.createElement('div');
        popup.className = 'comment-popup';
        popup.innerHTML = this.getCommentPopupHTML(selectedText);

        // Position popup
        const rect = range.getBoundingClientRect();
        const popupWidth = 320;
        const popupHeight = 300;

        let left = rect.left + (rect.width / 2) - (popupWidth / 2);
        let top = rect.bottom + 10;

        // Adjust for viewport boundaries
        if (left < 10) left = 10;
        if (left + popupWidth > window.innerWidth - 10) {
            left = window.innerWidth - popupWidth - 10;
        }
        if (top + popupHeight > window.innerHeight - 10) {
            top = rect.top - popupHeight - 10;
        }

        popup.style.left = left + 'px';
        popup.style.top = top + 'px';

        // Add to document
        document.body.appendChild(popup);
        activeCommentPopup = popup;

        // Setup handlers
        this.setupCommentPopupHandlers(popup, range, selectedText);
    }

    getCommentPopupHTML(selectedText) {
        return `
            <div class="comment-popup-header">
                <h3 class="comment-popup-title">Add Comment</h3>
                <button class="comment-popup-close" type="button">×</button>
            </div>
            <div class="comment-input-container">
                <textarea class="comment-textarea" placeholder="Add your comment..." maxlength="1000"></textarea>
                <div class="comment-char-counter">0 / 1000 characters</div>
            </div>
            <div class="comment-actions">
                <button class="comment-btn comment-btn-secondary" type="button">Cancel</button>
                <button class="comment-btn comment-btn-primary" type="button">Save Comment</button>
            </div>
        `;
    }

    setupCommentPopupHandlers(popup, range, selectedText) {
        // Close button
        const closeBtn = popup.querySelector('.comment-popup-close');
        closeBtn.addEventListener('click', () => this.closeCommentPopup());

        // Cancel button
        const cancelBtn = popup.querySelector('.comment-btn-secondary');
        cancelBtn.addEventListener('click', () => this.closeCommentPopup());

        // Save button
        const saveBtn = popup.querySelector('.comment-btn-primary');
        saveBtn.addEventListener('click', () => this.saveComment(range, selectedText));

        // Textarea character counter
        const textarea = popup.querySelector('.comment-textarea');
        const counter = popup.querySelector('.comment-char-counter');
        textarea.addEventListener('input', () => {
            const length = textarea.value.length;
            counter.textContent = `${length} / 1000 characters`;
            
            if (length > 900) {
                counter.classList.add('warning');
            } else {
                counter.classList.remove('warning');
            }
            
            if (length >= 1000) {
                counter.classList.add('error');
            } else {
                counter.classList.remove('error');
            }

            // Enable/disable save button
            saveBtn.disabled = length === 0;
        });

        // Keyboard shortcuts
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                this.saveComment(range, selectedText);
            } else if (e.key === 'Escape') {
                this.closeCommentPopup();
            }
        });

        // Auto-focus the textarea for immediate typing
        textarea.focus();

        // Setup handlers
        // popup.querySelector('.comment-popup-close').addEventListener('click', () => this.closeCommentPopup());
        
        // const editBtn = popup.querySelector('[data-action="edit"]');
        // editBtn.addEventListener('click', () => this.editComment(comment));
        
        // const deleteBtn = popup.querySelector('[data-action="delete"]');
        // deleteBtn.addEventListener('click', () => this.deleteComment(comment));
    }

    saveComment(range, selectedText) {
        const popup = activeCommentPopup;
        if (!popup) return;

        const textarea = popup.querySelector('.comment-textarea');
        const commentText = textarea.value.trim();

        if (!commentText) {
            this.showMessage('Please enter a comment', 'warning');
            return;
        }

        // Create comment data
        const commentId = 'comment-' + Date.now();

        const pageEl = (range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer
            : range.startContainer.parentNode
        )?.closest?.('.gsr-page');

        const allPages = Array.from(document.querySelectorAll('.gsr-page'));
        const pageIndex = pageEl ? allPages.indexOf(pageEl) : -1;

        let position = null;
        try {
            const rect = range.getBoundingClientRect();
            if (pageEl) {
                const pageRect = pageEl.getBoundingClientRect();
                position = {
                xPercent: ((rect.left - pageRect.left) / pageRect.width) * 100,
                yPercent: ((rect.top - pageRect.top) / pageRect.height) * 100,
                widthPercent: (rect.width / pageRect.width) * 100,
                heightPercent: (rect.height / pageRect.height) * 100
                };
            }
        } catch (_) {}

        const comment = {
            id: commentId,
            type: 'comment',
            text: commentText,
            selection: {
                startXPath: this.getCommentXPath(range.startContainer),
                endXPath: this.getCommentXPath(range.endContainer),
                startOffset: range.startOffset,
                endOffset: range.endOffset,
                selectedText: selectedText
            },
            // NEW: position for export
            position: position,
            pageIndex: pageIndex,
            timestamp: new Date().toISOString()
        };

        // Apply visual indicator to selected text
        this.applyCommentIndicator(range, commentId);

        // Save comment to storage
        this.saveCommentToStorage(comment);

        // Close popup
        this.closeCommentPopup();

        // Add to history for undo/redo
        const historyAction = {
            type: 'comment_create',
            commentId: commentId,
            comment: comment
        };
        this.addToHistory(historyAction);

        // Clear selection
        window.getSelection().removeAllRanges();
    }

    applyCommentIndicator(range, commentId) {
        try {
            const span = document.createElement('span');
            span.className = 'pdf-comment';
            span.dataset.commentId = commentId;
            span.addEventListener('click', () => this.showCommentDisplay(commentId));
            span.addEventListener('mouseenter', () => this.showCommentPreview(commentId, span));
            span.addEventListener('mouseleave', () => this.hideCommentPreview());

            range.surroundContents(span);
        } catch (error) {
            console.warn('Could not apply comment indicator:', error);
        }
    }

    saveCommentToStorage(comment) {
        if (!pdfUrl) return;

        chrome.storage.local.get([pdfUrl], (result) => {
            if (chrome.runtime.lastError) {
                console.error('Error loading annotations:', chrome.runtime.lastError);
                return;
            }

            const annotations = result[pdfUrl] || [];
            annotations.push(comment);

            chrome.storage.local.set({ [pdfUrl]: annotations }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error saving comment:', chrome.runtime.lastError);
                } else {
                    console.log('Comment saved:', comment);
                }
            });
        });
    }

    showCommentDisplay(commentId) {
        chrome.storage.local.get([pdfUrl], (result) => {
            const annotations = result[pdfUrl] || [];
            const comment = annotations.find(ann => ann.id === commentId);
            
            if (comment) {
                this.showCommentDisplayPopup(comment);
            }
        });
    }

    showCommentDisplayPopup(comment) {
        this.closeCommentPopup();

        const popup = document.createElement('div');
        popup.className = 'comment-popup';
        popup.innerHTML = `
            <div class="comment-popup-header">
                <h3 class="comment-popup-title">Comment</h3>
                <button class="comment-popup-close" type="button">×</button>
            </div>
            <div class="comment-display">
                <div class="comment-meta">
                    <span class="comment-timestamp">${this.formatTimestamp(comment.timestamp)}</span>
                </div>
                <div class="comment-content">${comment.text}</div>
                <div class="comment-display-actions">
                    <button class="comment-action-btn" data-action="edit" type="button">Edit</button>
                    <button class="comment-action-btn" data-action="delete" type="button">Delete</button>
                </div>
            </div>
        `;

        // Position popup near the comment
        const commentElement = document.querySelector(`[data-comment-id="${comment.id}"]`);
        if (commentElement) {
            const rect = commentElement.getBoundingClientRect();
            popup.style.left = (rect.left + rect.width / 2 - 160) + 'px';
            popup.style.top = (rect.bottom + 10) + 'px';
        } else {
            popup.style.left = '50%';
            popup.style.top = '50%';
            popup.style.transform = 'translate(-50%, -50%)';
        }

        document.body.appendChild(popup);
        activeCommentPopup = popup;

        // Setup handlers
        popup.querySelector('.comment-popup-close').addEventListener('click', () => this.closeCommentPopup());
        
        const editBtn = popup.querySelector('[data-action="edit"]');
        editBtn.addEventListener('click', () => this.editComment(comment));
        
        const deleteBtn = popup.querySelector('[data-action="delete"]');
        deleteBtn.addEventListener('click', () => this.deleteComment(comment));
    }

    showCommentPreview(commentId, element) {
        this.hideCommentPreview();

        commentPreviewTimeout = setTimeout(() => {
            chrome.storage.local.get([pdfUrl], (result) => {
                const annotations = result[pdfUrl] || [];
                const comment = annotations.find(ann => ann.id === commentId);
                
                if (comment) {
                    const preview = document.createElement('div');
                    preview.className = 'comment-preview-tooltip show';
                    preview.textContent = comment.text.substring(0, 100) + (comment.text.length > 100 ? '...' : '');
                    
                    const rect = element.getBoundingClientRect();
                    preview.style.left = (rect.left + rect.width / 2 - 100) + 'px';
                    preview.style.top = (rect.top - 40) + 'px';
                    
                    document.body.appendChild(preview);
                    preview.dataset.commentPreview = 'true';
                }
            });
        }, 500);
    }

    hideCommentPreview() {
        if (commentPreviewTimeout) {
            clearTimeout(commentPreviewTimeout);
            commentPreviewTimeout = null;
        }

        const preview = document.querySelector('[data-comment-preview="true"]');
        if (preview) {
            preview.remove();
        }
    }

    deleteComment(comment) {
        chrome.storage.local.get([pdfUrl], (result) => {
            const annotations = result[pdfUrl] || [];
            const filteredAnnotations = annotations.filter(ann => ann.id !== comment.id);
            
            chrome.storage.local.set({ [pdfUrl]: filteredAnnotations }, () => {
                // Remove visual indicator
                const element = document.querySelector(`[data-comment-id="${comment.id}"]`);
                if (element) {
                    const parent = element.parentNode;
                    const textNode = document.createTextNode(element.textContent);
                    parent.replaceChild(textNode, element);
                    parent.normalize();
                }
                
                this.closeCommentPopup();

                this.addToHistory({
                    type: 'comment_delete',
                    comment: comment
                });
            });
        });
    }

    editComment(comment) {
        this.closeCommentPopup();

        const popup = document.createElement('div');
        popup.className = 'comment-popup';
        popup.innerHTML = `
            <div class="comment-popup-header">
                <h3 class="comment-popup-title">Edit Comment</h3>
                <button class="comment-popup-close" type="button">×</button>
            </div>
            <div class="comment-input-container">
                <textarea class="comment-textarea" placeholder="Edit your comment..." maxlength="1000">${comment.text}</textarea>
                <div class="comment-char-counter">${comment.text.length} / 1000 characters</div>
            </div>
            <div class="comment-actions">
                <button class="comment-btn comment-btn-secondary" type="button">Cancel</button>
                <button class="comment-btn comment-btn-primary" type="button">Save Changes</button>
            </div>
        `;

        // Position popup near the comment
        const commentElement = document.querySelector(`[data-comment-id="${comment.id}"]`);
        if (commentElement) {
            const rect = commentElement.getBoundingClientRect();
            popup.style.left = (rect.left + rect.width / 2 - 160) + 'px';
            popup.style.top = (rect.bottom + 10) + 'px';
        } else {
            popup.style.left = '50%';
            popup.style.top = '50%';
            popup.style.transform = 'translate(-50%, -50%)';
        }

        document.body.appendChild(popup);
        activeCommentPopup = popup;

        // Setup handlers
        popup.querySelector('.comment-popup-close').addEventListener('click', () => this.closeCommentPopup());
        
        const cancelBtn = popup.querySelector('.comment-btn-secondary');
        cancelBtn.addEventListener('click', () => this.closeCommentPopup());
        
        const saveBtn = popup.querySelector('.comment-btn-primary');
        saveBtn.addEventListener('click', () => this.saveEditedComment(comment));

        // Textarea character counter
        const textarea = popup.querySelector('.comment-textarea');
        const counter = popup.querySelector('.comment-char-counter');
        textarea.addEventListener('input', () => {
            const length = textarea.value.length;
            counter.textContent = `${length} / 1000 characters`;
            
            if (length > 900) {
                counter.classList.add('warning');
            } else {
                counter.classList.remove('warning');
            }
            
            if (length >= 1000) {
                counter.classList.add('error');
            } else {
                counter.classList.remove('error');
            }

            // Enable/disable save button
            saveBtn.disabled = length === 0;
        });

        // Keyboard shortcuts
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                this.saveEditedComment(comment);
            } else if (e.key === 'Escape') {
                this.closeCommentPopup();
            }
        });

        // Focus textarea and select all text for easy editing
        textarea.focus();
        textarea.select();
    }

    saveEditedComment(originalComment) {
        const popup = activeCommentPopup;
        if (!popup) return;

        const textarea = popup.querySelector('.comment-textarea');
        const newCommentText = textarea.value.trim();

        if (!newCommentText) {
            this.showMessage('Please enter a comment', 'warning');
            return;
        }

        if (newCommentText === originalComment.text) {
            // No changes made, just close the popup
            this.closeCommentPopup();
            return;
        }

        // Update comment in storage
        chrome.storage.local.get([pdfUrl], (result) => {
            const annotations = result[pdfUrl] || [];
            const commentIndex = annotations.findIndex(ann => ann.id === originalComment.id);
            
            if (commentIndex !== -1) {
                // Update the comment text and timestamp
                annotations[commentIndex].text = newCommentText;
                annotations[commentIndex].lastModified = new Date().toISOString();
                
                chrome.storage.local.set({ [pdfUrl]: annotations }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Error saving edited comment:', chrome.runtime.lastError);
                        this.showMessage('Error saving comment', 'error');
                    } else {
                        console.log('Comment edited successfully:', annotations[commentIndex]);
                        this.showMessage('Comment updated successfully', 'info');
                        
                        // Add to history for undo/redo
                        const historyAction = {
                            type: 'comment_edit',
                            commentId: originalComment.id,
                            oldText: originalComment.text,
                            newText: newCommentText
                        };
                        this.addToHistory(historyAction);
                    }
                    
                    this.closeCommentPopup();
                });
            } else {
                console.error('Comment not found for editing:', originalComment.id);
                this.showMessage('Comment not found', 'error');
                this.closeCommentPopup();
            }
        });
    }

    getCommentXPath(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const parent = node.parentNode;
            const textNodes = Array.from(parent.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
            const textIndex = textNodes.indexOf(node);
            
            const parentXPath = this.getElementXPath(parent);
            return `${parentXPath}/text()[${textIndex + 1}]`;
        } else {
            return this.getElementXPath(node);
        }
    }

    getElementXPath(element) {
        const parts = [];
        let current = element;
        
        while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
            let index = 0;
            let sibling = current.previousSibling;
            
            while (sibling) {
                if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) {
                    index++;
                }
                sibling = sibling.previousSibling;
            }
            
            const tagName = current.nodeName.toLowerCase();
            const pathIndex = index > 0 ? `[${index + 1}]` : '';
            parts.unshift(tagName + pathIndex);
            current = current.parentNode;
        }
        
        return parts.length ? '/' + parts.join('/') : '';
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString();
    }

    loadAndApplyComments() {
        if (!pdfUrl) {
            console.log('No PDF URL available for loading comments');
            return;
        }
        
        chrome.storage.local.get([pdfUrl], (result) => {
            if (chrome.runtime.lastError) {
                console.error('Error loading comments:', chrome.runtime.lastError);
                return;
            }
            
            const annotations = result[pdfUrl] || [];
            const comments = annotations.filter(ann => ann.type === 'comment');
            
            console.log(`Found ${comments.length} comments for PDF:`, pdfUrl);
            
            if (comments.length > 0) {
                console.log('Loading existing comments:', comments);
                
                // Wait for page content to be loaded before applying comments
                this.waitForPageContentAndApplyComments(comments);
            } else {
                console.log('No comments found to restore');
            }
        });
    }

    waitForPageContentAndApplyComments(comments, retryCount = 0) {
        const maxRetries = 10;
        const retryDelay = 1000; // 1 second
        
        // Check if we have meaningful page content
        const pageElements = document.querySelectorAll('.gsr-page');
        const textContainers = document.querySelectorAll('.gsr-text-ctn');
        
        console.log(`Attempt ${retryCount + 1}: Found ${pageElements.length} page elements, ${textContainers.length} text containers`);
        
        // Check if any text container has meaningful content
        let hasContent = false;
        textContainers.forEach(container => {
            if (container.textContent.trim().length > 100) {
                hasContent = true;
            }
        });
        
        if (hasContent || retryCount >= maxRetries) {
            if (hasContent) {
                console.log('Page content detected, applying comments');
            } else {
                console.log('Max retries reached, attempting to apply comments anyway');
            }
            
            // Apply comments to all existing pages
            pageElements.forEach((pageElement, index) => {
                console.log(`Applying comments to page ${index + 1}`);
                this.applyCommentsToPage(pageElement, comments);
            });
            
            // Also apply comments to any text containers that might exist without page wrapper
            textContainers.forEach((textContainer, index) => {
                const pageElement = textContainer.closest('.gsr-page') || textContainer;
                console.log(`Applying comments to text container ${index + 1}`);
                this.applyCommentsToPage(pageElement, comments);
            });
        } else {
            console.log(`Page content not ready, retrying in ${retryDelay}ms...`);
            setTimeout(() => {
                this.waitForPageContentAndApplyComments(comments, retryCount + 1);
            }, retryDelay);
        }
    }

    applyCommentsToPage(pageElement, comments) {
        const textContainer = pageElement.querySelector('.gsr-text-ctn');
        if (!textContainer) {
            console.log('No text container found in page element');
            return;
        }

        // Check if the text container has meaningful content
        const textContent = textContainer.textContent.trim();
        if (textContent.length < 50) {
            console.log('Text container appears to be empty or loading, skipping comment application');
            return;
        }

        console.log(`Applying ${comments.length} comments to page with ${textContent.length} characters`);

        // First, remove any existing comment indicators to prevent duplicates
        const existingCommentSpans = textContainer.querySelectorAll('.pdf-comment');
        console.log(`Found ${existingCommentSpans.length} existing comment indicators, removing them`);
        existingCommentSpans.forEach(span => {
            const parent = span.parentNode;
            const textNode = document.createTextNode(span.textContent);
            parent.replaceChild(textNode, span);
        });
        // Normalize to combine adjacent text nodes
        textContainer.normalize();

        comments.forEach(comment => {
            try {
                const range = this.recreateRangeFromComment(textContainer, comment);
                if (range) {
                    this.applyCommentIndicator(range, comment.id);
                    console.log('Successfully applied comment:', comment.id);
                } else {
                    console.log('Failed to recreate range for comment:', comment.id);
                }
            } catch (error) {
                console.warn('Could not restore comment:', comment.id, error);
            }
        });
    }

    recreateRangeFromComment(textContainer, comment) {
        try {
            const selection = comment.selection;
            
            // First try XPath-based approach
            let startNode = this.findNodeByCommentXPath(textContainer, selection.startXPath);
            let endNode = this.findNodeByCommentXPath(textContainer, selection.endXPath);
            
            // If XPath fails, try text-based fallback
            if (!startNode || !endNode) {
                console.log('XPath failed for comment:', comment.id, 'trying text-based approach');
                console.log('Looking for text:', JSON.stringify(selection.selectedText));
                console.log('In container:', textContainer);
                const result = this.findNodesByText(textContainer, selection.selectedText);
                if (result) {
                    console.log('Text-based approach succeeded for comment:', comment.id);
                    startNode = result.startNode;
                    endNode = result.endNode;
                    selection.startOffset = result.startOffset;
                    selection.endOffset = result.endOffset;
                } else {
                    console.log('Text-based approach also failed for comment:', comment.id);
                    console.log('Available text in container:', textContainer.textContent.substring(0, 200) + '...');
                }
            }
            
            if (!startNode || !endNode) {
                console.warn('Could not find nodes for comment:', comment.id);
                return null;
            }

            const range = document.createRange();
            range.setStart(startNode, selection.startOffset);
            range.setEnd(endNode, selection.endOffset);
            
            const rangeText = range.toString().trim();
            if (rangeText === selection.selectedText || rangeText.includes(selection.selectedText)) {
                return range;
            } else {
                console.warn('Text mismatch for comment:', comment.id, 'expected:', selection.selectedText, 'got:', rangeText);
                return null;
            }
        } catch (error) {
            console.error('Error recreating range for comment:', comment.id, error);
            return null;
        }
    }

    findNodeByCommentXPath(container, xpath) {
        try {
            if (xpath.includes('/text()[')) {
                const textMatch = xpath.match(/(.+)\/text\(\[(\d+)\]\)$/);
                if (textMatch) {
                    const elementXPath = textMatch[1];
                    const textIndex = parseInt(textMatch[2]) - 1;
                    
                    const elementResult = document.evaluate(elementXPath, container, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    const element = elementResult.singleNodeValue;
                    
                    if (element) {
                        const textNodes = Array.from(element.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
                        return textNodes[textIndex] || null;
                    }
                }
            }
            
            const result = document.evaluate(xpath, container, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            return result.singleNodeValue;
        } catch (error) {
            console.error('Error finding node by XPath:', xpath, error);
            return null;
        }
    }

    findNodesByText(container, targetText) {
        try {
            console.log('Searching for text in container:', targetText);
            
            // Get all text nodes in the container
            const walker = document.createTreeWalker(
                container,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            const textNodes = [];
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.trim()) {
                    textNodes.push(node);
                }
            }
            
            console.log(`Found ${textNodes.length} text nodes in container`);
            
            // Get the full text content of the container
            const fullText = container.textContent;
            console.log('Full container text length:', fullText.length);
            
            // Try exact match first
            if (fullText.includes(targetText)) {
                console.log('Target text found in container');
                
                // Try to find the target text across text nodes
                for (let i = 0; i < textNodes.length; i++) {
                    const startNode = textNodes[i];
                    const startText = startNode.textContent;
                    
                    // Check if the target text is entirely within this node
                    const startIndex = startText.indexOf(targetText);
                    if (startIndex !== -1) {
                        console.log('Found target text in single node');
                        return {
                            startNode: startNode,
                            endNode: startNode,
                            startOffset: startIndex,
                            endOffset: startIndex + targetText.length
                        };
                    }
                    
                    // Check if the target text spans multiple nodes
                    let combinedText = startText;
                    let endNodeIndex = i;
                    // Keep track of where spaces were added before nextText
                    const spaceBeforeNode = [false]; // first node never has space before

                    while (endNodeIndex < textNodes.length - 1 && !combinedText.includes(targetText)) {
                        endNodeIndex++;
                        const nextText = textNodes[endNodeIndex].textContent;
                        // Decide if we add a space before nextText
                        let addSpace = (nextText.length > 0 && nextText[0] !== '.' && nextText[0] !== ',');
                        if (addSpace) {
                            combinedText += ' ' + nextText;
                        } else {
                            combinedText += nextText;
                        }
                        spaceBeforeNode.push(addSpace);
                    }
                    
                    const combinedStartIndex = combinedText.indexOf(targetText);
                    if (combinedStartIndex !== -1) {
                        console.log('Found target text spanning multiple nodes');
                        // Calculate offsets
                        // We need to account for the spaces that were added when mapping combinedText index to node offsets
                        let currentLength = 0; // length in combinedText as we traverse nodes
                        let currentRawLength = 0; // length in original text nodes (without spaces)
                        let startOffset = 0;
                        let endOffset = 0;
                        let actualStartNode = startNode;
                        let actualEndNode = startNode;
                        let foundStart = false;
                        let foundEnd = false;

                        const targetEndInCombined = combinedStartIndex + targetText.length;
                        
                        // Find start position
                        for (let j = i; j <= endNodeIndex; j++) {
                            // If a space was added before this node, account for it in combinedText
                            if (j > i && spaceBeforeNode[j - i]) {
                                currentLength += 1; // for the space in combinedText
                            }
                            const nodeText = textNodes[j].textContent;
                            const nodeTextLen = nodeText.length;

                            if (!foundStart && currentLength + nodeTextLen > combinedStartIndex) {
                                actualStartNode = textNodes[j];
                                startOffset = combinedStartIndex - currentLength;
                                foundStart = true;
                            }

                            // Find end position
                            if (!foundEnd && currentLength + nodeTextLen >= targetEndInCombined) {
                                actualEndNode = textNodes[j];
                                endOffset = targetEndInCombined - currentLength;
                                foundEnd = true;
                            }

                            currentLength += nodeTextLen;

                            if (foundStart && foundEnd) break;
                        }
                        
                        // Find end position
                        currentLength = 0;
                        const targetEndIndex = combinedStartIndex + targetText.length;
                        for (let j = i; j <= endNodeIndex; j++) {
                            const nodeText = textNodes[j].textContent;
                            if (currentLength + nodeText.length >= targetEndIndex) {
                                actualEndNode = textNodes[j];
                                endOffset = targetEndIndex - currentLength;
                                break;
                            }
                            currentLength += nodeText.length;
                        }
                        
                        return {
                            startNode: actualStartNode,
                            endNode: actualEndNode,
                            startOffset: startOffset,
                            endOffset: endOffset
                        };
                    }
                }
            } else {
                console.log('Target text not found in container');
                // Try fuzzy matching - look for partial matches
                const words = targetText.split(/\s+/);
                if (words.length > 1) {
                    console.log('Trying fuzzy matching with words:', words);
                    for (const word of words) {
                        if (word.length > 3 && fullText.includes(word)) {
                            console.log('Found partial match for word:', word);
                            // Try to find this word and use it as a fallback
                            for (let i = 0; i < textNodes.length; i++) {
                                const node = textNodes[i];
                                const wordIndex = node.textContent.indexOf(word);
                                if (wordIndex !== -1) {
                                    return {
                                        startNode: node,
                                        endNode: node,
                                        startOffset: wordIndex,
                                        endOffset: wordIndex + word.length
                                    };
                                }
                            }
                        }
                    }
                }
            }
            
            console.log('No match found for target text');
            return null;
        } catch (error) {
            console.error('Error finding nodes by text:', error);
            return null;
        }
    }

    removeCommentById(commentId) {
        chrome.storage.local.get([pdfUrl], (result) => {
            const anns = result[pdfUrl] || [];
            const idx = anns.findIndex(a => a.type === 'comment' && a.id === commentId);
            if (idx < 0) return;
            const c = anns[idx];

            // Remove visual indicator
            const el = document.querySelector(`[data-comment-id="${commentId}"]`);
            if (el) {
                const parent = el.parentNode;
                const textNode = document.createTextNode(el.textContent);
                parent.replaceChild(textNode, el);
                parent.normalize();
            }

            anns.splice(idx, 1);
            chrome.storage.local.set({ [pdfUrl]: anns }, () => {
            // history already pushed by caller when appropriate
            });
        });
    }

    recreateComment(comment) {
        // put it back in storage and re-apply marker
        chrome.storage.local.get([pdfUrl], (result) => {
            const anns = result[pdfUrl] || [];
            if (!anns.some(a => a.id === comment.id)) {
                anns.push(comment);
                chrome.storage.local.set({ [pdfUrl]: anns }, () => {
                    const textContainers = document.querySelectorAll('.gsr-text-ctn');
                    textContainers.forEach(ctn => {
                        const range = this.recreateRangeFromComment(ctn, comment);
                        if (range) this.applyCommentIndicator(range, comment.id);
                    });
                });
            }
        });
    }

    updateCommentText(commentId, newText) {
        chrome.storage.local.get([pdfUrl], (result) => {
            const anns = result[pdfUrl] || [];
            const idx = anns.findIndex(a => a.type === 'comment' && a.id === commentId);
            if (idx < 0) return;
            anns[idx].text = newText;
            anns[idx].lastModified = new Date().toISOString();
            chrome.storage.local.set({ [pdfUrl]: anns }, () => {
            // no UI change needed; popup shows from storage
            });
        });
    }

}

function initializeAnnotation() {
    // clear legacy empty-key entries from storage
    chrome.storage.local.remove([''], () => console.log('Cleared legacy empty-key entries'));

    console.log('Initializing annotation...');
    const colorPickerManager = new ColorPickerManager();
    setupDrawingCanvas();
    
    // Store the instance globally for access from other functions
    window.colorPickerManagerInstance = colorPickerManager;

    // Set up message listener for PDF URL
    window.addEventListener("message", (event) => {
        if (event.data.type === "FROM_CONTENT_SCRIPT") {
            const receivedPdfUrl = event.data.pdfUrl;
            if (receivedPdfUrl === '__proto__' || receivedPdfUrl === 'constructor' || receivedPdfUrl === 'prototype') {
                console.error('Invalid PDF URL received:', receivedPdfUrl);
                return;
            }
            pdfUrl = receivedPdfUrl;
            console.log('PDF URL received:', pdfUrl);
            // ADD: pull mirrored drawings into localStorage so the canvas can redraw
            hydrateDrawingsFromChromeStorage();

            // Load existing comments when PDF URL is received
            // Add multiple attempts with increasing delays to ensure page content is loaded
            setTimeout(() => {
                colorPickerManager.loadAndApplyComments();
            }, 500);
            
            setTimeout(() => {
                colorPickerManager.loadAndApplyComments();
            }, 1500);
            
            setTimeout(() => {
                colorPickerManager.loadAndApplyComments();
            }, 3000);
            
            // Also set up a periodic check for the first 10 seconds
            let retryCount = 0;
            const maxRetries = 5;
            const retryInterval = setInterval(() => {
                retryCount++;
                colorPickerManager.loadAndApplyComments();
                
                if (retryCount >= maxRetries) {
                    clearInterval(retryInterval);
                }
            }, 2000);

            redrawAllDrawings();
            renderAllTexts();
        }
    }, false);

    // Initialize color pickers for each tool
    Object.keys(TOOLS).forEach(tool => {
        colorPickerManager.setupToolButton(tool);
    });

    // Set up button click handlers
    setupButtonHandlers(colorPickerManager);

    // Set up document event listeners with the manager instance
    document.addEventListener('mouseup', () => handleSelection(colorPickerManager));
    document.addEventListener('click', (e) => handleErase(e, colorPickerManager));

    // Add drawing event listeners
    // drawingCanvas.addEventListener('mousedown', (e) => startDrawing(e, colorPickerManager));
    document.addEventListener(
        'mousedown',
        (e) => {if (window.colorPickerManagerInstance?.activeTools.isDrawing) {
            startDrawing(e, window.colorPickerManagerInstance);}},
        true
    ); // <-- capture phase
    document.addEventListener('mousemove', (e) => draw(e, colorPickerManager));
    document.addEventListener('mouseup', () => endDrawing(colorPickerManager));

    // Add Text tool event listeners
    // Text: click to place, type, Enter/blur to save
    document.addEventListener('click', (e) => {
        const mgr = window.colorPickerManagerInstance;
        if (!mgr?.activeTools.isTexting) return;
        // avoid clicking on UI
        const el = e.target;
        if (el.closest('.color-popup') || el.closest('.comment-popup')) return;
        createTextEditorAtClick(e, mgr);
    }, true); // <-- capture phase

    observePageChanges();
}

function hexToPdfRgb(colorStr) {
    const namedColors = {
        "yellow": "#FFFF00",
        "greenyellow": "#ADFF2F",
        "cyan": "#00FFFF",
        "magenta": "#FF00FF",
        "red": "#FF0000",
        "white": "#FFFFFF",
        "black": "#000000",
        "green": "#008000",
        "blue": "#0000FF",
    };

    // Convert named colors to hex
    if (namedColors[colorStr.toLowerCase()]) {
        colorStr = namedColors[colorStr.toLowerCase()];
    }

    // Validate hex color
    const hexMatch = colorStr.match(/^#?([a-fA-F0-9]{6})$/);
    if (!hexMatch) {
        console.warn(`Invalid color: ${colorStr}, defaulting to yellow.`);
        colorStr = "#FFFF00";  // default fallback
    }

    const hex = colorStr.replace('#', '');
    const r = parseInt(hex.substring(0,2), 16) / 255;
    const g = parseInt(hex.substring(2,4), 16) / 255;
    const b = parseInt(hex.substring(4,6), 16) / 255;
    return PDFLib.rgb(r, g, b);
}

async function exportAnnotatedPdf() {
    if (!pdfUrl) {
        alert('No PDF loaded.');
        return;
    }

    // 1) Load the original PDF
    const pdfData = await fetch(pdfUrl).then(res => res.arrayBuffer());
    const pdfDoc = await PDFLib.PDFDocument.load(pdfData);

    // Embed a standard font once for text/comments
    const helvetica = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica); // official StandardFonts enum

    const pages = pdfDoc.getPages();

    // 2) Load annotations (highlights + comments) from chrome.storage
    const annotations = await new Promise(resolve => {
        chrome.storage.local.get([pdfUrl], (result) => {
        resolve(result[pdfUrl] || []);
        });
    });

    // 3) Load drawings from localStorage (they are saved there in your code)
    const drawings = JSON.parse(localStorage.getItem(`drawings_${pdfUrl}`) || '[]');

    // 4) Load texts from chrome.storage (key we will use below)
    const texts = await new Promise(resolve => {
        chrome.storage.local.get([`${pdfUrl}__texts`], (result) => {
            resolve(result[`${pdfUrl}__texts`] || []);
        });
    });

    // 5) Export HIGHLIGHTS (rectangle overlays)
    annotations
        .filter(a => Array.isArray(a.nodes)) // ignore comments here
        .forEach(group => {
        group.nodes.forEach(node => {
            const pos = node.position;
            const pageIndex = pos.pageIndex;
            if (pageIndex < 0 || pageIndex >= pages.length) return;

            const page = pages[pageIndex];
            const { width: W, height: H } = page.getSize();

            const x = (pos.xPercent / 100) * W;
            const yTop = (pos.yPercent / 100) * H;
            const w = (pos.widthPercent / 100) * W;
            const h = (pos.heightPercent / 100) * H;
            const y = H - yTop - h; // convert from DOM-top-left to PDF bottom-left

            page.drawRectangle({
            x, y, width: w, height: h,
            color: hexToPdfRgb(group.color || '#FFFF00'),
            borderWidth: 0,
            opacity: 0.4,          // supported on drawRectangle
            borderOpacity: 0.75,   // supported
            });
        });
        });

    // 6) Export DRAWINGS (lines)
    drawings.forEach(d => {
        (d.segments || []).forEach(seg => {
        const pageIndex = seg.pageIndex;
        if (pageIndex < 0 || pageIndex >= pages.length) return;
        const page = pages[pageIndex];
        const { width: W, height: H } = page.getSize();

        const pts = seg.points || [];
        for (let i = 1; i < pts.length; i++) {
            const p0 = pts[i - 1];
            const p1 = pts[i];

            const x0 = (p0.xPercent / 100) * W;
            const y0 = H - (p0.yPercent / 100) * H;
            const x1 = (p1.xPercent / 100) * W;
            const y1 = H - (p1.yPercent / 100) * H;

            page.drawLine({
            start: { x: x0, y: y0 },
            end:   { x: x1, y: y1 },
            color: hexToPdfRgb(d.color || '#000000'),
            thickness: d.lineWidth || 2,
            });
        }
        });
    });

    // 7) Export TEXT notes
    texts.forEach(t => {
        const pageIndex = t.pageIndex;
        if (pageIndex < 0 || pageIndex >= pages.length) return;
        const page = pages[pageIndex];
        const { width: W, height: H } = page.getSize();

        const x = (t.xPercent / 100) * W;
        const y = H - (t.yPercent / 100) * H;

        page.drawText(t.text || '', {
        x, y,
        font: helvetica,
        size: t.size || 14,
        color: hexToPdfRgb(t.color || '#000000'),
        maxWidth: Math.max(50, (t.maxWidthPercent ? (t.maxWidthPercent / 100) * W : (W * 0.6))), // keep it sensible
        lineHeight: (t.size || 14) * 1.25,
        });
    });

    // ====== 8) Export COMMENTS in a right-hand sidebar (replace original block) ======
    (() => {
    // 8.a collect comments (your annotations array is already loaded)
    const comments = (annotations || []).filter(a => a.type === 'comment');

    // Helper: per-page grouping & anchor Y detection (PDF coords)
    function collectCommentsForPage(pageIdx, pageWidth, pageHeight) {
        const out = [];
        for (const c of comments) {
        // Prefer saved position/pageIndex if present
        let yPdf = null;
        if (c.position && typeof c.position.yPercent === 'number' && typeof c.position.heightPercent === 'number' && typeof c.pageIndex === 'number' && c.pageIndex === pageIdx) {
            const selYTop = (c.position.yPercent / 100) * pageHeight;
            const selH    = (c.position.heightPercent / 100) * pageHeight;
            const selY    = pageHeight - selYTop - selH;
            yPdf = selY + selH / 2;
        } else if (c.id) {
            // Fallback: measure from live DOM span
            const span = document.querySelector(`[data-comment-id="${c.id}"]`);
            const pageEl = span ? span.closest('.gsr-page') : null;
            if (pageEl) {
            const idx = Array.from(document.querySelectorAll('.gsr-page')).indexOf(pageEl);
            if (idx === pageIdx) {
                const rect = span.getBoundingClientRect();
                const pageRect = pageEl.getBoundingClientRect();
                const yPercent = ((rect.top - pageRect.top) / pageRect.height) * 100;
                const yTopPdf  = pageHeight - (yPercent / 100) * pageHeight;
                const hPdf     = (rect.height / pageRect.height) * pageHeight;
                yPdf = yTopPdf - hPdf / 2;
            }
            }
        }
        if (yPdf != null) out.push({ id: c.id, text: c.text || '', yPdf });
        }
        // sort by anchor to stack neatly
        out.sort((a, b) => b.yPdf - a.yPdf);
        return out;
    }

    // Helper: simple word wrap using font metrics
    function wrapTextForWidth(text, font, size, maxWidth) {
        const words = String(text || '').split(/\s+/);
        const lines = [];
        let line = '';
        for (const w of words) {
        const test = line ? (line + ' ' + w) : w;
        const width = helvetica.widthOfTextAtSize(test, size); // uses the same font you embedded
        if (width <= maxWidth) {
            line = test;
        } else {
            if (line) lines.push(line);
            line = w;
        }
        }
        if (line) lines.push(line);
        return lines;
    }

    // For each page, if it has comments, extend width and lay out a sidebar
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { width: origW, height: origH } = page.getSize();

        const pageComments = collectCommentsForPage(i, origW, origH);
        if (pageComments.length === 0) continue;

        const SIDEBAR_W = 220;           // width of the side column
        const PAD = 10;                   // inner padding
        const size = 10;                  // comment text size
        const lineH = size * 1.35;

        // 8.b grow page width to make room (content stays put on the left)
        page.setSize(origW + SIDEBAR_W, origH); // official API to set page size. :contentReference[oaicite:3]{index=3}

        // background column
        page.drawRectangle({
        x: origW, y: 0, width: SIDEBAR_W, height: origH,
        color: PDFLib.rgb(0.965, 0.965, 0.965)
        });

        // 8.c draw stacked boxes and thin connectors
        let cursorY = origH - PAD;
        for (const c of pageComments) {
        const boxX = origW + 8;
        const boxW = SIDEBAR_W - 16;

        const lines = wrapTextForWidth(c.text, helvetica, size, boxW - 2 * PAD);
        const boxH  = Math.min(PAD + lines.length * lineH + PAD, Math.max(40, origH * 0.35)); // keep boxes modest

        // box
        page.drawRectangle({
            x: boxX, y: cursorY - boxH, width: boxW, height: boxH,
            color: PDFLib.rgb(1, 1, 1),
            borderColor: PDFLib.rgb(0.8, 0.8, 0.8),
            borderWidth: 1
        });

        // text
        page.drawText(lines.join('\n'), {
            x: boxX + PAD,
            y: cursorY - PAD - lineH,
            font: helvetica,                 // you embedded 'helvetica' earlier
            size,
            lineHeight: lineH,
            maxWidth: boxW - 2 * PAD,
            color: PDFLib.rgb(0, 0, 0)
        }); // drawText config per pdf-lib docs. :contentReference[oaicite:4]{index=4}

        // connector line from content edge to box center
        const targetY = Math.max(cursorY - boxH / 2, 10);
        page.drawLine({
            start: { x: origW, y: c.yPdf },
            end:   { x: boxX,  y: targetY },
            color: PDFLib.rgb(0.6, 0.6, 0.6),
            thickness: 0.75
        });

        cursorY -= (boxH + 8);
        if (cursorY < 40) cursorY = origH - PAD; // simple column flow
        }
    }
    })();

    const pdfBytes = await pdfDoc.save();
    download(pdfBytes, "annotated.pdf");
}

function download(data, filename) {
    const blob = new Blob([data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function setupButtonHandlers(colorPickerManager) {
    // const alertNotImplemented = () => alert('This feature is not implemented yet!');

    // Tool buttons
    document.getElementById(TOOLS.highlight.id).addEventListener('click', () => {
        colorPickerManager.activateTool('highlight');
    });

    // Draw button
    document.getElementById(TOOLS.draw.id).addEventListener('click', () => {
        colorPickerManager.activateTool('draw');
    });

    // Text button
    document.getElementById(TOOLS.text.id).addEventListener('click', () => {
        colorPickerManager.activateTool('text');
    });

    // Comment button
    document.getElementById(TOOLS.comment.id).addEventListener('click', () => {
        colorPickerManager.activateTool('comment');
    });

    // Other buttons
    document.getElementById('erase-btn').addEventListener('click', () => {
        colorPickerManager.activateTool('erase');
    });

    document.getElementById('erase-all-btn').addEventListener('click', eraseAllAnnotations);

    document.getElementById('export-btn').addEventListener('click', exportAnnotatedPdf);
    
    document.getElementById('settings-btn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    document.getElementById('star-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://github.com/salcc/Scholar-PDF-Reader-with-Annotations' });
    });
}


function observePageChanges() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('gsr-text-ctn')) {
                        console.log('New page content loaded, applying annotations, drawings, texts and comments');
                        chrome.storage.local.get([pdfUrl], function (result) {
                            if (chrome.runtime.lastError) {
                                console.error('Error loading annotations:', chrome.runtime.lastError);
                                return;
                            }
                            const savedAnnotations = result[pdfUrl] || [];
                            console.log('Loaded annotations:', savedAnnotations);

                            // Apply highlights
                            const highlights = savedAnnotations.filter(ann => ann.type !== 'comment');
                            applyAnnotationsToPage(node.closest('.gsr-page'), highlights);
                            
                            // Apply drawings
                            // redrawAllDrawings();
                            scheduleRedraw();

                            // Apply texts
                            renderAllTexts();

                            // Apply comments
                            const comments = savedAnnotations.filter(ann => ann.type === 'comment');
                            if (comments.length > 0 && window.colorPickerManagerInstance) {
                                window.colorPickerManagerInstance.applyCommentsToPage(node.closest('.gsr-page'), comments);
                            }
                        });
                    }
                });
            }
        });
    });

    const config = { childList: true, subtree: true };
    observer.observe(document.body, config);
}

function handleSelection(colorPickerManager) {
    if (colorPickerManager.activeTools.isHighlighting && !colorPickerManager.activeTools.isErasing) {
        if (!pdfUrl) {
            console.warn('Document not ready yet — please wait a moment.');
            return;
        }

        const selection = window.getSelection();
        if (selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const groupId = 'group-' + Date.now();
        // Pass the current color from the manager
        highlightRange(range, groupId, colorPickerManager.currentColors.highlight);
        selection.removeAllRanges();
    }
    else if (colorPickerManager.activeTools.isCommenting) {
        colorPickerManager.handleCommentSelection();
    }
}

function handleErase(event, colorPickerManager) {
    if (!colorPickerManager.activeTools.isErasing) return;

    // 1) Try drawings first (per-stroke erase)
    if (eraseDrawingAtPoint(event.clientX, event.clientY)) {
        return;
    }

    // 2) Fallback: try highlights (existing behavior)
    const highlightSpan = findHighlightSpanAtPoint(event.clientX, event.clientY);
    if (highlightSpan) {
        const groupId = highlightSpan.dataset.groupId;
        eraseAnnotation(groupId);
    }

    // 3) Try text notes
    const textEl = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.pdf-text');
    if (textEl && textEl.dataset.textId) {
        removeTextById(textEl.dataset.textId); // pushes history itself
        return;
    }

}

function findHighlightSpanAtPoint(x, y) {
    const elements = document.elementsFromPoint(x, y);
    for (let element of elements) {
        if (element.classList.contains('pdf-highlight')) {
            return element;
        }

        const nestedHighlight = element.querySelector('.pdf-highlight');
        if (nestedHighlight) {
            const rect = nestedHighlight.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                return nestedHighlight;
            }
        }
    }
    return null;
}

function highlightRange(range, groupId, color) {
    const startNode = range.startContainer;
    const endNode = range.endContainer;
    const commonAncestor = range.commonAncestorContainer;

    const highlightedNodes = [];
    const nodesToProcess = getNodesBetween(startNode, endNode, commonAncestor);

    nodesToProcess.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const startOffset = (node === startNode) ? range.startOffset : 0;
            const endOffset = (node === endNode) ? range.endOffset : node.length;

            // Check if the node is already partially highlighted
            const existingHighlights = getExistingHighlights(node);
            if (existingHighlights.length > 0) {
                highlightedNodes.push(...handleOverlappingHighlights(node, startOffset, endOffset, groupId, existingHighlights, color));
            } else {
                highlightedNodes.push(highlightTextNode(node, startOffset, endOffset, groupId, color));
            }
        }
    });

    // Save annotation and record in history
    saveAnnotation(groupId, highlightedNodes, color);
}

function saveAnnotation(groupId, nodesWithPositions, color) {
    const annotation = {
        id: groupId,
        color: color,
        nodes: nodesWithPositions.map(item => ({
            text: item.span.textContent,
            xpath: getXPath(item.span),
            offset: getTextOffset(item.span),
            position: item.position  // Needed for exporting to PDF
        }))
    };

    chrome.storage.local.get([pdfUrl], function (result) {
        if (chrome.runtime.lastError) {
            console.error('Error loading annotations:', chrome.runtime.lastError);
            return;
        }

        const savedAnnotations = result[pdfUrl] || [];
        const existingIndex = savedAnnotations.findIndex(group => group.id === groupId);
        if (existingIndex !== -1) {
            savedAnnotations[existingIndex] = annotation;
        } else {
            savedAnnotations.push(annotation);
        }

        chrome.storage.local.set({ [pdfUrl]: savedAnnotations }, function () {
            if (chrome.runtime.lastError) {
                console.error('Error saving annotations:', chrome.runtime.lastError);
            } else {
                console.log('Annotation saved for %s:', pdfUrl, annotation);
                
                // Add to history for undo/redo
                const historyAction = {
                    type: 'highlight_create',
                    groupId: groupId,
                    highlightGroup: annotation
                };
                
                // Access the colorPickerManager instance
                if (window.colorPickerManagerInstance) {
                    window.colorPickerManagerInstance.addToHistory(historyAction);
                }
            }
        });
    });
}

function getExistingHighlights(node) {
    const highlights = [];
    while (node && node !== document.body) {
        if (node.classList && node.classList.contains('pdf-highlight')) {
            highlights.push(node);
        }
        node = node.parentNode;
    }
    return highlights;
}


function handleOverlappingHighlights(node, startOffset, endOffset, groupId, existingHighlights, color) {
    const highlightedNodes = [];
    let currentOffset = 0;

    existingHighlights.sort((a, b) => {
        return a.textContent.indexOf(node.textContent) - b.textContent.indexOf(node.textContent);
    });

    existingHighlights.forEach((highlight) => {
        const highlightStart = highlight.textContent.indexOf(node.textContent);
        const highlightEnd = highlightStart + node.textContent.length;

        if (startOffset < highlightStart && currentOffset < highlightStart) {
            highlightedNodes.push(highlightTextNode(node, currentOffset, highlightStart, groupId, color));
        }

        if (startOffset <= highlightEnd && endOffset >= highlightStart) {
            highlight.style.backgroundColor = color;
            highlight.dataset.groupId = groupId;
            highlightedNodes.push(highlight);
        }

        currentOffset = highlightEnd;
    });

    if (endOffset > currentOffset) {
        highlightedNodes.push(highlightTextNode(node, currentOffset, endOffset, groupId, color));
    }

    return highlightedNodes;
}

function highlightTextNode(node, startOffset, endOffset, groupId, color) {
    const range = document.createRange();
    range.setStart(node, startOffset);
    range.setEnd(node, endOffset);

    const rect = range.getBoundingClientRect();
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'pdf-highlight';
    highlightSpan.style.backgroundColor = color;
    highlightSpan.dataset.groupId = groupId;

    range.surroundContents(highlightSpan);

    const pageElement = highlightSpan.closest('.gsr-page');
    const pageRect = pageElement.getBoundingClientRect();

    // Calculate relative positions (%) within the page
    const position = {
        xPercent: ((rect.left - pageRect.left) / pageRect.width) * 100,
        yPercent: ((rect.top - pageRect.top) / pageRect.height) * 100,
        widthPercent: (rect.width / pageRect.width) * 100,
        heightPercent: (rect.height / pageRect.height) * 100,
        pageIndex: determineCurrentPageIndex(highlightSpan)
    };

    // return highlightSpan;
    return { span: highlightSpan, position };
}

// You need a helper to determine the PDF page index based on your DOM structure
function determineCurrentPageIndex(node) {
    const pageElement = node.closest('.gsr-page');
    return Array.from(document.querySelectorAll('.gsr-page')).indexOf(pageElement);
}

function getNodesBetween(startNode, endNode, commonAncestor) {
    const nodes = [];
    let currentNode = startNode;

    while (currentNode) {
        nodes.push(currentNode);
        if (currentNode === endNode) break;
        currentNode = getNextNode(currentNode, commonAncestor);
    }

    return nodes;
}

function getNextNode(node, stopNode) {
    if (node.firstChild) return node.firstChild;
    while (node) {
        if (node === stopNode) return null;
        if (node.nextSibling) return node.nextSibling;
        node = node.parentNode;
    }
    return null;
}

function removeHighlightGroup(group) {
    group.nodes.forEach(nodeInfo => {
        const node = findNodeByXPath(nodeInfo.xpath);
        if (node) {
            const highlightSpan = node.parentNode.querySelector(`[data-group-id="${group.id}"]`);
            if (highlightSpan) {
                const parent = highlightSpan.parentNode;
                const textContent = highlightSpan.textContent;
                const textNode = document.createTextNode(textContent);
                parent.replaceChild(textNode, highlightSpan);
            } else {
                console.warn('Highlight span not found for node:', node);
            }
        } else {
            // console.warn('Node not found for XPath:', nodeInfo.xpath);
        }
    });

    document.body.normalize();
}

function eraseAnnotation(groupId) {
    chrome.storage.local.get([pdfUrl], function (result) {
        if (chrome.runtime.lastError) {
            console.error('Error loading annotations:', chrome.runtime.lastError);
            return;
        }

        const savedAnnotations = result[pdfUrl] || [];
        const groupIndex = savedAnnotations.findIndex(group => group.id === groupId);
        if (groupIndex !== -1) {
            const group = savedAnnotations[groupIndex];
            
            // Save to history before removing
            if (window.colorPickerManagerInstance) {
                const historyAction = {
                    type: 'highlight_erase',
                    groupId: groupId,
                    highlightGroups: [group]
                };
                window.colorPickerManagerInstance.addToHistory(historyAction);
            }
            
            removeHighlightGroup(group);

            savedAnnotations.splice(groupIndex, 1);

            chrome.storage.local.set({ [pdfUrl]: savedAnnotations }, function () {
                if (chrome.runtime.lastError) {
                    console.error('Error saving annotations:', chrome.runtime.lastError);
                } else {
                    console.log('Annotation removed for groupId:', groupId);
                }
            });
        }
    });
}

function eraseAllAnnotations() {
    if (!confirm('Are you sure you want to erase ALL annotations (highlights, drawings, text, comments)? This action CANNOT be undone.')) {
        console.log('Erase all cancelled');
        return;
    }

    // 1) Load highlights/comments (same key as before)
    chrome.storage.local.get([pdfUrl], function (result) {
        if (chrome.runtime.lastError) {
            console.error('Error loading annotations:', chrome.runtime.lastError);
            return;
        }

        const savedAnnotations   = result[pdfUrl] || [];
        const hl      = savedAnnotations.filter(a => !a.type);
        // const comments= savedAnnotations.filter(a => a.type === 'comment');

        // 2) Also load TEXT notes for history (new key)
        chrome.storage.local.get([`${pdfUrl}__texts`], function (res2) {

            // ---- Remove highlights from DOM ----
            hl.forEach(group => removeHighlightGroup(group));

            // ---- Remove comment indicators from DOM ----
            document.querySelectorAll('.pdf-comment').forEach(el => {
                const parent = el.parentNode;
                const textNode = document.createTextNode(el.textContent);
                parent.replaceChild(textNode, el);
                parent.normalize();
            });

            // ---- Remove TEXT notes from DOM (correct class) ----
            document.querySelectorAll('.pdf-text').forEach(el => el.remove());

            // ---- Clear chrome.storage buckets ----
            chrome.storage.local.remove([pdfUrl], function () {
                if (chrome.runtime.lastError) console.error('Error clearing annotations:', chrome.runtime.lastError);
                else console.log('Cleared highlights/comments for', pdfUrl);
            });
            chrome.storage.local.remove([`${pdfUrl}__texts`], function () {
                if (chrome.runtime.lastError) console.error('Error clearing text notes:', chrome.runtime.lastError);
                else console.log('Cleared text notes for', pdfUrl);
            });

            // ---- Clear drawings & legacy text cache ----
            localStorage.removeItem(`drawings_${pdfUrl}`);
            // ADD: also clear mirrored drawings so import/export stays in sync
            chrome.storage.local.remove([`${pdfUrl}__drawings`]);
            // (in case an old build ever wrote this)
            localStorage.removeItem(`texts_${pdfUrl}`);

            // ---- Clear canvas now ----
            if (drawingCtx && drawingCanvas) {
                drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            }

            // Ensure UI reflects the wipe
            if (typeof scheduleRedraw === 'function') scheduleRedraw();
        });
    });
}

function findNodeByXPath(xpath) {
    try {
        const nodes = document.evaluate(xpath, document, null, XPathResult.ANY_TYPE, null);
        return nodes.iterateNext();
    } catch (e) {
        console.error('Error finding node by XPath:', xpath, e);
        return null;
    }
}

function applyAnnotationsToPage(pageElement, highlightGroups) {
    const textContainer = pageElement.querySelector('.gsr-text-ctn');
    if (!textContainer) return;

    highlightGroups.forEach(group => {
        group.nodes.forEach(nodeInfo => {
            const node = findNodeInPage(textContainer, nodeInfo.xpath, nodeInfo.text);
            if (node) {
                highlightNode(node, nodeInfo.text, group.color || currentColor, group.id);
            } else {
                // console.warn('Node not found for annotation:', nodeInfo);
            }
        });
    });
}

function findNodeInPage(textContainer, xpath, text) {
    try {
        const xpathResult = document.evaluate(xpath, textContainer, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const node = xpathResult.singleNodeValue;
        if (node && node.textContent.includes(text)) {
            return node;
        }
    } catch (e) {
        console.error('XPath evaluation failed:', e);
    }
    return null;
}


function getXPath(node) {
    const parts = [];
    while (node && node.nodeType === Node.ELEMENT_NODE) {
        let sibling = node;
        let siblingCount = 1;
        while ((sibling = sibling.previousSibling) !== null) {
            if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === node.nodeName) {
                siblingCount++;
            }
        }
        parts.unshift(node.nodeName.toLowerCase() + '[' + siblingCount + ']');
        node = node.parentNode;
    }
    
    // Remove the last element (innermost span)
    parts.pop();
    
    return '/' + parts.join('/');
}

function getTextOffset(node) {
    let offset = 0;
    let currentNode = node;
    while (currentNode.previousSibling) {
        currentNode = currentNode.previousSibling;
        if (currentNode.nodeType === Node.TEXT_NODE) {
            offset += currentNode.textContent.length;
        }
    }
    return offset;
}

function getAllTextNodes(container) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    let node;
    while (node = walker.nextNode()) {
        nodes.push(node);
    }
    return nodes;
}

function highlightNode(node, text, color, groupId) {
    const textNodes = getAllTextNodes(node);
    const fullText = textNodes.map(n => n.textContent).join('');
    const startIndex = fullText.indexOf(text);
    if (startIndex === -1) {
        console.warn('Highlight text not found in container');
        return;
    }
    const endIndex = startIndex + text.length;

    // Find start and end nodes/offsets
    let currentLength = 0, startNode, startOffset, endNode, endOffset;
    for (let node of textNodes) {
        let nextLength = currentLength + node.textContent.length;
        if (!startNode && startIndex < nextLength) {
            startNode = node;
            startOffset = startIndex - currentLength;
        }
        if (!endNode && endIndex <= nextLength) {
            endNode = node;
            endOffset = endIndex - currentLength;
            break;
        }
        currentLength = nextLength;
    }

    if (startNode && endNode) {
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'pdf-highlight';
        highlightSpan.style.backgroundColor = color;
        highlightSpan.dataset.groupId = groupId;
        try {
            range.surroundContents(highlightSpan);
            return highlightSpan;
        } catch (e) {
            console.error('Error highlighting across nodes:', e);
        }
    } else {
        console.warn('Could not determine start/end nodes for highlight');
    }
}



// Drawing functionality

function hydrateDrawingsFromChromeStorage() {
    if (!pdfUrl) return;
    chrome.storage.local.get([`${pdfUrl}__drawings`], (res) => {
        const arr = res[`${pdfUrl}__drawings`] || [];
        // Keep your current code paths happy by reflecting into localStorage
        localStorage.setItem(`drawings_${pdfUrl}`, JSON.stringify(arr));
        scheduleRedraw(); // or redrawAllDrawings();
    });
}

// --- Redraw scheduling and robust scroll listeners ---

/**
 * Update positions of text annotations during zoom/scroll
 * Converts page-relative percentages back to viewport coordinates
 */
function updateTextPositions() {
    const overlay = document.getElementById('pdf-text-overlay');
    if (!overlay) return;
    
    const textEls = overlay.querySelectorAll('.pdf-text[data-text-id]');
    textEls.forEach(el => {
        // Extract stored percentages from data attributes if available
        // Or recalculate from stored data
        const key = `${pdfUrl}__texts`;
        chrome.storage.local.get([key], (result) => {
            const arr = result[key] || [];
            const record = arr.find(t => t.id === el.dataset.textId);
            if (!record) return;
            
            const coords = percentToViewportCoords(record.pageIndex, record.xPercent, record.yPercent);
            if (!coords) return;
            
            el.style.left = `${coords.x}px`;
            el.style.top = `${coords.y}px`;
            // Update font size to follow page zoom
            let fontPx;
            if (typeof record.sizePercent === 'number' && !isNaN(record.sizePercent) && record.sizePercent > 0) {
                fontPx = (record.sizePercent / 100) * coords.pageRect.width;
            } else {
                fontPx = record.size || 14;
            }
            el.style.fontSize = `${Math.round(fontPx)}px`;
        });
    });
}

let _rafPending = false;
function scheduleRedraw() {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(() => {
        _rafPending = false;
        redrawAllDrawings();
        updateTextPositions();  // Update text element positions during zoom/scroll
    });
}

const _scrollTargets = new Set();
function isScrollable(el) {
    if (!el || el === document || el === window) return false;
    const style = getComputedStyle(el);
    const oy = style.overflowY, ox = style.overflowX;
    const canY = (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight;
    const canX = (ox === 'auto' || ox === 'scroll') && el.scrollWidth  > el.clientWidth;
    return canY || canX;
}

function addScrollTarget(el) {
    if (!el || _scrollTargets.has(el)) return;
    el.addEventListener('scroll', scheduleRedraw, { passive: true });
    _scrollTargets.add(el);
}

function attachScrollListeners() {
    // Global listeners
    window.addEventListener('scroll', scheduleRedraw, { passive: true });
    // Capture-phase listeners catch element scrolls that don't bubble
    document.addEventListener('scroll', scheduleRedraw, { passive: true, capture: true });
    // Extra signals for kinetic scroll / touchpad momentum
    document.addEventListener('wheel', scheduleRedraw, { passive: true, capture: true });
    document.addEventListener('touchmove', scheduleRedraw, { passive: true, capture: true });

    // Attach to the PDF viewer's actual scroll container(s)
    const firstPage = document.querySelector('.gsr-page');
    let p = firstPage ? firstPage.parentElement : null;
    while (p && p !== document.body) {
        if (isScrollable(p)) addScrollTarget(p);
        p = p.parentElement;
    }
}

function setupDrawingCanvas() {
    drawingCanvas = document.createElement('canvas');
    drawingCanvas.id = 'drawing-canvas';
    drawingCanvas.style.position = 'fixed';  // was 'absolute'
    drawingCanvas.style.top = '0';
    drawingCanvas.style.left = '0';
    drawingCanvas.style.pointerEvents = 'none';
    drawingCanvas.style.zIndex = '9000';
    
    // Set canvas size to match viewport
    const updateCanvasSize = () => {
        drawingCanvas.width = window.innerWidth;
        drawingCanvas.height = window.innerHeight;
        redrawAllDrawings();
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    document.body.appendChild(drawingCanvas);

    attachScrollListeners();

    drawingCtx = drawingCanvas.getContext('2d');
}

// --- Drawing helpers for page-relative coordinates ---

function getPageAtPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const pageEl = el.closest('.gsr-page');
    if (!pageEl) return null;
    const rect = pageEl.getBoundingClientRect();
    const index = Array.from(document.querySelectorAll('.gsr-page')).indexOf(pageEl);
    return { pageEl, rect, index };
}

function clientToPercent(clientX, clientY, rect) {
    return {
        xPercent: ((clientX - rect.left) / rect.width) * 100,
        yPercent: ((clientY - rect.top) / rect.height) * 100,
    };
}

function percentToCanvasXY(p, rect) {
    const x = rect.left + (p.xPercent / 100) * rect.width;
    const y = rect.top + (p.yPercent / 100) * rect.height;
    const canvasRect = drawingCanvas.getBoundingClientRect();
    return [x - canvasRect.left, y - canvasRect.top];
}

// Like toCanvasXY, but from raw client coords
function toCanvasXYFromClient(clientX, clientY) {
    const rect = drawingCanvas.getBoundingClientRect();
    return [clientX - rect.left, clientY - rect.top];
}

// Build a Path2D for just the segments that live on a given page
function buildPathForDrawingOnPage(drawing, pageIndex) {
    const path = new Path2D(); // MDN Path2D lets us replay paths and test hit quickly
    let hasAny = false;        // https://developer.mozilla.org/en-US/docs/Web/API/Path2D
    const page = document.querySelectorAll('.gsr-page')[pageIndex];
    if (!page) return { path, hasAny: false };
    const rect = page.getBoundingClientRect();
    (drawing.segments || []).forEach(seg => {
        if (seg.pageIndex !== pageIndex) return;
        const pts = seg.points || [];
        pts.forEach((pt, i) => {
            const [x, y] = percentToCanvasXY(pt, rect);
            if (i === 0) path.moveTo(x, y);
            else path.lineTo(x, y);
        });
        hasAny = hasAny || pts.length > 0;
    });
    return { path, hasAny };
}

// Redraw every stored stroke using current page positions
function redrawAllDrawings() {
    if (!drawingCtx) return;
    drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    const drawings = JSON.parse(localStorage.getItem(`drawings_${pdfUrl}`) || '[]');
    drawings.forEach(drawing => {
        drawingCtx.beginPath();
        drawingCtx.strokeStyle = drawing.color || '#000';
        drawingCtx.lineWidth = 2;
        drawingCtx.lineCap = 'round';
        drawingCtx.lineJoin = 'round';
        (drawing.segments || []).forEach(seg => {
            const page = document.querySelectorAll('.gsr-page')[seg.pageIndex];
            if (!page) return;
            const rect = page.getBoundingClientRect();
            const pts = seg.points || [];
            pts.forEach((pt, i) => {
                const [cx, cy] = percentToCanvasXY(pt, rect);
                if (i === 0) drawingCtx.moveTo(cx, cy);
                else drawingCtx.lineTo(cx, cy);
            });
        });
        drawingCtx.stroke();
    });
}

// Try to erase the topmost drawing at (clientX, clientY). Returns true if something was erased.
function eraseDrawingAtPoint(clientX, clientY) {
    if (!drawingCtx) return false;
    const pageInfo = getPageAtPoint(clientX, clientY);
    if (!pageInfo) return false;

    const [cx, cy] = toCanvasXYFromClient(clientX, clientY);
    const drawings = JSON.parse(localStorage.getItem(`drawings_${pdfUrl}`) || '[]');

    // Iterate from topmost (last drawn) to bottom
    for (let i = drawings.length - 1; i >= 0; i--) {
        const d = drawings[i];
        const { path, hasAny } = buildPathForDrawingOnPage(d, pageInfo.index);
        if (!hasAny) continue;

        // Use slightly thicker test width for an easier hit (MDN isPointInStroke)
        const prev = drawingCtx.lineWidth;
        drawingCtx.lineWidth = (d.lineWidth || 2) + 6;
        const hit = drawingCtx.isPointInStroke(path, cx, cy); // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isPointInStroke
        drawingCtx.lineWidth = prev;

        if (hit) {
            // History for undo/redo (optional but nice)
            if (window.colorPickerManagerInstance) {
                window.colorPickerManagerInstance.addToHistory({ type: 'draw_erase', drawing: d });
            }
            drawings.splice(i, 1);
            localStorage.setItem(`drawings_${pdfUrl}`, JSON.stringify(drawings));
            // ADD mirror update
            chrome.storage.local.set({ [`${pdfUrl}__drawings`]: drawings });
            
            scheduleRedraw();
            return true;
        }
    }
    return false;
}

function removeDrawingById(drawingId) {
    const drawings = JSON.parse(localStorage.getItem(`drawings_${pdfUrl}`) || '[]');
    const idx = drawings.findIndex(d => d.id === drawingId);
    if (idx !== -1) {
        const [removed] = drawings.splice(idx, 1);
        localStorage.setItem(`drawings_${pdfUrl}`, JSON.stringify(drawings));
        // ADD mirror update
        chrome.storage.local.set({ [`${pdfUrl}__drawings`]: drawings });

        scheduleRedraw();
        return removed;
    }
    return null;
}

function restoreDrawing(drawing) {
    const drawings = JSON.parse(localStorage.getItem(`drawings_${pdfUrl}`) || '[]');
    // Avoid duplicates
    if (!drawings.some(d => d.id === drawing.id)) {
        drawings.push(drawing);
        localStorage.setItem(`drawings_${pdfUrl}`, JSON.stringify(drawings));
        scheduleRedraw();
    }
}

function startDrawing(e, colorPickerManager) {
    if (!colorPickerManager.activeTools.isDrawing) return;
    const pageInfo = getPageAtPoint(e.clientX, e.clientY);
    if (!pageInfo) return;

    isDrawing = true;
    currentPath = [{
        pageIndex: pageInfo.index,
        points: [clientToPercent(e.clientX, e.clientY, pageInfo.rect)]
     }];

    drawingCtx.beginPath();
    drawingCtx.strokeStyle = colorPickerManager.currentColors.draw;
    drawingCtx.lineWidth = 2;
    drawingCtx.lineCap = 'round';
    drawingCtx.lineJoin = 'round';

    const [sx, sy] = percentToCanvasXY(currentPath[0].points[0], pageInfo.rect);
    drawingCtx.moveTo(sx, sy);
}

function draw(e, colorPickerManager) {
    if (!isDrawing || !colorPickerManager.activeTools.isDrawing) return;
    const pageInfo = getPageAtPoint(e.clientX, e.clientY);
    if (!pageInfo) return;

    const lastSeg = currentPath[currentPath.length - 1];
    const pt = clientToPercent(e.clientX, e.clientY, pageInfo.rect);

    if (lastSeg.pageIndex !== pageInfo.index) {
        // New page => start a new segment
        currentPath.push({ pageIndex: pageInfo.index, points: [pt] });
        const [mx, my] = percentToCanvasXY(pt, pageInfo.rect);
        drawingCtx.moveTo(mx, my);
    } else {
        lastSeg.points.push(pt);
        const [lx, ly] = percentToCanvasXY(pt, pageInfo.rect);
        drawingCtx.lineTo(lx, ly);
        drawingCtx.stroke();
    }
}

function endDrawing(colorPickerManager) {
    if (!isDrawing || !colorPickerManager.activeTools.isDrawing) return;
    isDrawing = false;

    const totalPoints = currentPath.reduce((acc, seg) => acc + (seg.points?.length || 0), 0);
    // Save the drawing
    if (totalPoints > 1) {
        const newId = 'draw-' + Date.now() + '-' + Math.random().toString(36).slice(2,7);
        const drawingData = {
            id: newId,
            segments: currentPath,
            color: colorPickerManager.currentColors.draw,
            lineWidth: 2,
            timestamp: Date.now()
        };
        
        // Get existing drawings or initialize empty array
        const drawings = JSON.parse(localStorage.getItem(`drawings_${pdfUrl}`) || '[]');
        drawings.push(drawingData);
        localStorage.setItem(`drawings_${pdfUrl}`, JSON.stringify(drawings));

        // ADD: keep a mirrored copy in chrome.storage.local so backup works
        chrome.storage.local.set({ [`${pdfUrl}__drawings`]: drawings });

        // Add to history so Ctrl/Cmd+Z works consistently
        if (window.colorPickerManagerInstance) {
            window.colorPickerManagerInstance.addToHistory({
                type: 'draw_create',
                drawingId: newId,
                drawing: drawingData
            });
        }
    }
    currentPath = [];
}

// Texting functionality

/**
 * Create a text overlay layer above all pages to hold text annotations
 * This keeps text separate from page content, preventing DOM interference
 */
function ensureTextOverlayLayer() {
    let overlay = document.getElementById('pdf-text-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'pdf-text-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9500;
        `;
        document.body.appendChild(overlay);
    }
    return overlay;
}

/**
 * Convert page-relative percentages to viewport coordinates
 */
function percentToViewportCoords(pageIndex, xPercent, yPercent) {
    const pages = Array.from(document.querySelectorAll('.gsr-page'));
    const pageEl = pages[pageIndex];
    if (!pageEl) return null;
    
    const rect = pageEl.getBoundingClientRect();
    const x = rect.left + (xPercent / 100) * rect.width;
    const y = rect.top + (yPercent / 100) * rect.height;
    
    return { x, y, pageRect: rect };
}

function createTextEditorAtClick(e, manager) {
    const pageInfo = getPageAtPoint(e.clientX, e.clientY);
    if (!pageInfo) return;

    const rect = pageInfo.rect;
    const { xPercent, yPercent } = clientToPercent(e.clientX, e.clientY, rect);

    const box = document.createElement('div');
    box.className = 'pdf-text';
    box.contentEditable = 'true';
    box.textContent = ''; // start empty
    box.style.cssText = `
        position:fixed;
        left:${rect.left + (xPercent / 100) * rect.width}px;
        top:${rect.top + (yPercent / 100) * rect.height}px;
        color:${manager.currentColors.text || '#000'};
        font:${14}px Helvetica, Arial, sans-serif;
        line-height:1.25;
        padding:2px 3px;
        background:rgba(255,255,255,0.0);
        border:none;
        min-width: 2ch;
        outline:none;
        cursor:text;
        user-select:text;
        z-index: 9999;
        pointer-events: auto;
    `;

    // Add to overlay layer instead of to the page
    const overlay = ensureTextOverlayLayer();
    overlay.appendChild(box);
    box.focus();

    const commit = () => {
        // If empty, remove
        if (!box.textContent.trim()) {
            box.remove();
            return;
        }
        persistTextElement(box, {
            pageIndex: pageInfo.index,
            xPercent, yPercent,
            color: manager.currentColors.text || '#000000',
            size: 14
        }, true /*isNew*/);
    };

    box.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
        if (ev.key === 'Escape') { ev.preventDefault(); box.remove(); }
    });
    box.addEventListener('blur', commit);
}

function persistTextElement(el, baseData, isNew) {
    const key = `${pdfUrl}__texts`;
    chrome.storage.local.get([key], (result) => {
        const arr = result[key] || [];

        // If we’re re-saving an existing element (e.g., after editing/moving)
        let record, oldRecord;
        if (el.dataset.textId) {
            const idx = arr.findIndex(t => t.id === el.dataset.textId);
            if (idx >= 0) {
                oldRecord = { ...arr[idx] };
                record = arr[idx];
                record.text = el.textContent;
                record.color = el.style.color || record.color;
                // Recompute percents from current CSS left/top (overlay coordinates)
                // Find the page via stored pageIndex
                const pages = Array.from(document.querySelectorAll('.gsr-page'));
                const pageEl = pages[record.pageIndex];
                if (pageEl) {
                    const pageRect = pageEl.getBoundingClientRect();
                    // left/top are in px (fixed overlay). Convert back to percent of page
                    const leftPx = parseFloat(el.style.left);
                    const topPx = parseFloat(el.style.top);
                    if (!isNaN(leftPx)) {
                        const xPercent = ((leftPx - pageRect.left) / pageRect.width) * 100;
                        record.xPercent = Math.max(0, Math.min(100, xPercent));
                    }
                    if (!isNaN(topPx)) {
                        const yPercent = ((topPx - pageRect.top) / pageRect.height) * 100;
                        record.yPercent = Math.max(0, Math.min(100, yPercent));
                    }

                    // Update size as percentage of page width so it scales with zoom
                    const computed = window.getComputedStyle(el);
                    const fontPx = parseFloat(computed.fontSize) || (record.size || 14);
                    record.sizePercent = (fontPx / pageRect.width) * 100;
                    // Keep legacy size field for compatibility
                    record.size = Math.round(fontPx);
                }
            }
        }
        else {
            record = {
                id: 'text-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
                text: el.textContent,
                pageIndex: baseData.pageIndex,
                xPercent: baseData.xPercent,
                yPercent: baseData.yPercent,
                color: baseData.color || '#000000',
                // store both legacy px size and sizePercent for zoom scaling
                size: baseData.size || 14,
                sizePercent: 0,
                maxWidthPercent: 60, // default wrap width ~60% page
                timestamp: Date.now()
            };
            // compute initial sizePercent based on current page width
            const pages = Array.from(document.querySelectorAll('.gsr-page'));
            const pageEl = pages[record.pageIndex];
            if (pageEl) {
                const pageRect = pageEl.getBoundingClientRect();
                record.sizePercent = (record.size / pageRect.width) * 100;
            }
            arr.push(record);
            el.dataset.textId = record.id;

            // History: create
            window.colorPickerManagerInstance?.addToHistory({
                type: 'text_create',
                text: { ...record }
            });
        }

        chrome.storage.local.set({ [key]: arr }, () => {
            if (oldRecord) {
                // History: edit (position or text changed)
                window.colorPickerManagerInstance?.addToHistory({
                    type: 'text_edit',
                    oldText: oldRecord,
                    newText: { ...record }
                });
            }
        });
    });
}

function renderAllTexts() {
    const key = `${pdfUrl}__texts`;
    chrome.storage.local.get([key], (result) => {
        const arr = result[key] || [];
        const overlay = ensureTextOverlayLayer();
        const pages = Array.from(document.querySelectorAll('.gsr-page'));
        
        arr.forEach(t => {
            const pageEl = pages[t.pageIndex];
            if (!pageEl) return;

            // avoid duplicates
            if (overlay.querySelector(`[data-text-id="${t.id}"]`)) return;

            const coords = percentToViewportCoords(t.pageIndex, t.xPercent, t.yPercent);
            if (!coords) return;

            const el = document.createElement('div');
            el.className = 'pdf-text';
            el.dataset.textId = t.id;
            el.textContent = t.text || '';
            el.contentEditable = false;
            // Compute font size in px so it scales with page width (zoom)
            let fontPx;
            if (typeof t.sizePercent === 'number' && !isNaN(t.sizePercent) && t.sizePercent > 0) {
                fontPx = (t.sizePercent / 100) * coords.pageRect.width;
            } else {
                // Legacy fallback: use stored px size and migrate to percent for future
                fontPx = t.size || 14;
                try {
                    const key2 = `${pdfUrl}__texts`;
                    chrome.storage.local.get([key2], (res) => {
                        const arr2 = res[key2] || [];
                        const idx2 = arr2.findIndex(x => x.id === t.id);
                        if (idx2 >= 0) {
                            arr2[idx2].sizePercent = (fontPx / coords.pageRect.width) * 100;
                            chrome.storage.local.set({ [key2]: arr2 });
                        }
                    });
                } catch (e) {
                    // ignore storage errors
                }
            }

            el.style.cssText = `
                position:fixed;
                left:${coords.x}px;
                top:${coords.y}px;
                color:${t.color || '#000'};
                font:${Math.round(fontPx)}px Helvetica, Arial, sans-serif;
                line-height:1.25;
                padding:2px 3px;
                background:rgba(255,255,255,0.0);
                border:none;
                user-select:text;
                z-index: 9999;
                pointer-events: auto;
            `;

            // Double-click to edit
            el.addEventListener('dblclick', () => {
                el.contentEditable = 'true';
                el.focus();
            });

            // Blur to save edit
            el.addEventListener('blur', () => {
                el.contentEditable = 'false';
                persistTextElement(el, null, false);
            });

            // Simple drag (mousedown -> move)
            let dragging = false, startX=0, startY=0, startLeft=0, startTop=0;
            el.addEventListener('mousedown', (ev) => {
                if (!window.colorPickerManagerInstance?.activeTools.isTexting) return;
                dragging = true;
                startX = ev.clientX; startY = ev.clientY;
                startLeft = parseFloat(el.style.left); startTop = parseFloat(el.style.top);
                ev.preventDefault();
            });
            document.addEventListener('mousemove', (ev) => {
                if (!dragging) return;
                const pageRect = coords.pageRect;
                const dx = (ev.clientX - startX);
                const dy = (ev.clientY - startY);
                el.style.left = `${startLeft + dx}px`;
                el.style.top  = `${startTop + dy}px`;
            }, true);
            document.addEventListener('mouseup', () => {
                if (dragging) {
                dragging = false;
                persistTextElement(el, null, false);
                }
            }, true);

            overlay.appendChild(el);
        });
    });
}

function removeTextById(textId, pushHistory = true) {
    const key = `${pdfUrl}__texts`;
    chrome.storage.local.get([key], (result) => {
        const arr = result[key] || [];
        const idx = arr.findIndex(t => t.id === textId);
        if (idx < 0) return;

        const removed = arr[idx];
        arr.splice(idx, 1);
        chrome.storage.local.set({ [key]: arr }, () => {
        document.querySelectorAll(`[data-text-id="${textId}"]`).forEach(n => n.remove());
        if (pushHistory) {
            window.colorPickerManagerInstance?.addToHistory({
            type: 'text_delete',
            text: removed
            });
        }
        });
    });
}

function restoreText(textObj) {
    const key = `${pdfUrl}__texts`;
    chrome.storage.local.get([key], (result) => {
        const arr = result[key] || [];
        if (!arr.some(t => t.id === textObj.id)) {
        arr.push(textObj);
        chrome.storage.local.set({ [key]: arr }, () => {
            renderAllTexts();
        });
        }
    });
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeAnnotation);
