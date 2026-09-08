import type { BoardData } from '../parser';
import { getComponentCenterAndBounds } from '../parser';

export const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number, pan: { x: number; y: number }, scale: number) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;

    // Grid spacing adapts to zoom level
    let spacing = 50;
    if (scale > 15) spacing = 10;
    else if (scale > 5) spacing = 25;
    else if (scale < 0.5) spacing = 200;

    const gridStep = spacing * scale;
    const startX = pan.x % gridStep;
    const startY = pan.y % gridStep;

    for (let x = startX; x < w; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let y = startY; y < h; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
    ctx.restore();
};

export const drawVias = (
    ctx: CanvasRenderingContext2D,
    signals: BoardData['signals'],
    selectedItem: { type: 'element' | 'net'; name: string } | null
) => {
    signals.forEach(sig => {
        sig.vias.forEach(via => {
            const isHighlightedNet = selectedItem?.type === 'net' && selectedItem?.name === sig.name;

            // Outer pad ring
            ctx.fillStyle = isHighlightedNet ? '#c084fc' : '#f59e0b'; // Gold or Violet
            ctx.beginPath();
            ctx.arc(via.x, -via.y, via.diameter / 2, 0, Math.PI * 2);
            ctx.fill();

            // Inner drill hole
            ctx.fillStyle = '#0f172a'; // match background
            ctx.beginPath();
            ctx.arc(via.x, -via.y, via.drill / 2, 0, Math.PI * 2);
            ctx.fill();
        });
    });
};

export const drawElementPads = (
    ctx: CanvasRenderingContext2D,
    elements: BoardData['elements'],
    visibleLayers: Set<number>
) => {
    elements.forEach(el => {
        // Rotate and translate coordinates for pads
        ctx.save();
        ctx.translate(el.x, -el.y);
        ctx.rotate((-el.angle * Math.PI) / 180);
        if (el.mirror) {
            ctx.scale(-1, 1);
        }

        // Draw Through-hole Pads
        el.pads.forEach(pad => {
            ctx.fillStyle = '#f59e0b'; // Gold copper
            ctx.beginPath();
            ctx.arc(pad.x, -pad.y, pad.diameter / 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#0f172a'; // Drill hole
            ctx.beginPath();
            ctx.arc(pad.x, -pad.y, pad.drill / 2, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw SMDs
        el.smds.forEach(smd => {
            // Determine color by SMD layer
            if (smd.layer === 1 && visibleLayers.has(1)) {
                ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'; // Top pad
            } else if (smd.layer === 16 && visibleLayers.has(16)) {
                ctx.fillStyle = 'rgba(59, 130, 246, 0.8)'; // Bottom pad
            } else {
                return;
            }

            ctx.save();
            ctx.translate(smd.x, -smd.y);
            if (smd.rot) {
                const smdAngle = parseFloat(smd.rot.replace(/^[a-zA-Z]/, '')) || 0;
                ctx.rotate((-smdAngle * Math.PI) / 180);
            }
            ctx.fillRect(-smd.dx / 2, -smd.dy / 2, smd.dx, smd.dy);
            ctx.restore();
        });

        ctx.restore();
    });
};

export const drawElementSilkscreen = (
    ctx: CanvasRenderingContext2D,
    elements: BoardData['elements'],
    drawBottom: boolean,
    scale: number
) => {
    ctx.strokeStyle = drawBottom ? 'rgba(168, 85, 247, 0.5)' : 'rgba(243, 244, 246, 0.5)'; // Light grey or purple
    ctx.fillStyle = drawBottom ? 'rgba(168, 85, 247, 0.7)' : 'rgba(243, 244, 246, 0.7)';
    
    elements.forEach(el => {
        if (el.mirror !== drawBottom) return;

        // 1. Draw rotated & mirrored package outline silkscreen lines
        ctx.save();
        ctx.translate(el.x, -el.y);
        ctx.rotate((-el.angle * Math.PI) / 180);
        if (el.mirror && !el.name.startsWith('___GLOBAL_SILK')) {
            ctx.scale(-1, 1);
        }

        ctx.lineWidth = 0.15;
        el.silks.forEach(silk => {
            if (drawBottom && silk.layer && silk.layer !== 22 && silk.layer !== 26) return;
            if (!drawBottom && silk.layer && silk.layer !== 21 && silk.layer !== 25) return;
            ctx.beginPath();
            ctx.moveTo(silk.x1, -silk.y1);
            ctx.lineTo(silk.x2, -silk.y2);
            ctx.stroke();
        });
        ctx.restore();

        // 2. Draw un-rotated, un-mirrored refdes label at the component center (skip dummy elements)
        if (!el.name.startsWith('___GLOBAL_SILK')) {
            ctx.save();
            ctx.translate(el.x, -el.y);
            ctx.font = `${Math.max(1.2, 8 / scale)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(el.name, 0, 0);
            ctx.restore();
        }
    });
};

export const drawSelectionHighlight = (
    ctx: CanvasRenderingContext2D,
    boardData: BoardData,
    selected: { type: 'element' | 'net'; name: string } | null,
    scale: number
) => {
    if (!selected || selected.type !== 'element') return;

    const el = boardData.elements.find(e => e.name === selected.name);
    if (!el) return;

    const { centerX, centerY } = getComponentCenterAndBounds(el);
    const drawX = centerX;
    const drawY = -centerY;

    ctx.save();
    ctx.strokeStyle = '#c084fc'; // Purple highlight
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.5 / scale;
    
    // Draw a glowing crosshair / bounding circle
    ctx.beginPath();
    ctx.arc(drawX, drawY, 8 / scale + 1.5, 0, Math.PI * 2);
    ctx.stroke();

    // Draw outer brackets
    const bracketSize = 12 / scale;
    ctx.beginPath();
    ctx.moveTo(drawX - bracketSize, drawY - bracketSize / 2);
    ctx.lineTo(drawX - bracketSize, drawY - bracketSize);
    ctx.lineTo(drawX - bracketSize / 2, drawY - bracketSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(drawX + bracketSize, drawY - bracketSize / 2);
    ctx.lineTo(drawX + bracketSize, drawY - bracketSize);
    ctx.lineTo(drawX + bracketSize / 2, drawY - bracketSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(drawX - bracketSize, drawY + bracketSize / 2);
    ctx.lineTo(drawX - bracketSize, drawY + bracketSize);
    ctx.lineTo(drawX - bracketSize / 2, drawY + bracketSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(drawX + bracketSize, drawY + bracketSize / 2);
    ctx.lineTo(drawX + bracketSize, drawY + bracketSize);
    ctx.lineTo(drawX + bracketSize / 2, drawY + bracketSize);
    ctx.stroke();

    ctx.restore();
};
