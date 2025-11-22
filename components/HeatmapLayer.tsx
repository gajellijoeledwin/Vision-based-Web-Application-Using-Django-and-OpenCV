import React, { useEffect, useRef } from 'react';
import { DetectedObject } from '../types';

interface HeatmapLayerProps {
  objects: DetectedObject[];
  width: number;
  height: number;
}

const HeatmapLayer: React.FC<HeatmapLayerProps> = ({ objects, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Intensity Map (Accumulative)
    // We use 'screen' blend mode to make overlapping areas brighter/hotter
    ctx.globalCompositeOperation = 'screen';

    objects.forEach(obj => {
       // Normalize coordinates
       const [ymin, xmin, ymax, xmax] = obj.box_2d;
       
       const boxLeft = (xmin / 1000) * width;
       const boxTop = (ymin / 1000) * height;
       const boxWidth = ((xmax - xmin) / 1000) * width;
       const boxHeight = ((ymax - ymin) / 1000) * height;
       
       const centerX = boxLeft + boxWidth / 2;
       const centerY = boxTop + boxHeight / 2;

       // Dynamic Radius based on Object Dimensions
       // We use an ellipse to match the aspect ratio of the object (e.g. tall person vs wide car)
       // This fixes the "inaccurate" heatmap issue where everything was a circle.
       const radiusX = Math.max(boxWidth / 1.5, 20);
       const radiusY = Math.max(boxHeight / 1.5, 20);

       const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(radiusX, radiusY));
       
       // Intensity based on confidence
       const intensity = Math.min(obj.confidence, 0.9); 
       
       // Draw Ellipse Gradient
       // Save context state for scaling transformation
       ctx.save();
       ctx.translate(centerX, centerY);
       ctx.scale(1, radiusY / radiusX); // Squash circle into ellipse
       ctx.translate(-centerX, -centerY);

       gradient.addColorStop(0, `rgba(255, 255, 255, ${intensity})`); // White core (hottest)
       gradient.addColorStop(0.4, `rgba(255, 255, 255, ${intensity * 0.5})`);
       gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Transparent edge

       ctx.fillStyle = gradient;
       ctx.beginPath();
       ctx.arc(centerX, centerY, radiusX, 0, Math.PI * 2); // Draw as circle, transformed to ellipse
       ctx.fill();
       ctx.restore();
    });

    // 2. Colorize (Map Greyscale to Color Ramp)
    ctx.globalCompositeOperation = 'source-over';
    
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Turbo/Jet Colormap Logic (Approximate)
    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3]; // The accumulated intensity (0-255)
        
        if (alpha > 10) { // Threshold to avoid background noise
            const t = alpha / 255;
            
            let r = 0, g = 0, b = 0;
            
            // 4-Stage Color Ramp: Blue -> Cyan -> Green -> Yellow -> Red
            // This gives higher fidelity than simple 3-stage ramps
            if (t < 0.25) {
                // Blue -> Cyan
                b = 255;
                g = (t / 0.25) * 255;
            } else if (t < 0.5) {
                // Cyan -> Green
                b = (1 - (t - 0.25) / 0.25) * 255;
                g = 255;
            } else if (t < 0.75) {
                // Green -> Yellow
                g = 255;
                r = ((t - 0.5) / 0.25) * 255;
            } else {
                // Yellow -> Red
                r = 255;
                g = (1 - (t - 0.75) / 0.25) * 255;
            }

            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = Math.min(180, alpha); // Keep some transparency
        } else {
            data[i+3] = 0; // Clear mostly transparent pixels
        }
    }

    ctx.putImageData(imageData, 0, 0);

  }, [objects, width, height]);

  return (
    <canvas 
        ref={canvasRef} 
        width={width} 
        height={height} 
        className="w-full h-full absolute top-0 left-0 pointer-events-none z-20 opacity-80 mix-blend-screen"
    />
  );
};

export default HeatmapLayer;