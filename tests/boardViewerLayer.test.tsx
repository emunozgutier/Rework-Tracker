import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { BoardSearch } from '../src/Pages/BoardViewer/SideMenu/search';

describe('BoardSearch Layer Annotations', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    const mockElements = [
        { name: 'C1', value: '10uF', package: '0603', layer: 'top' as const },
        { name: 'C2', value: '0.1uF', package: '0402', layer: 'bottom' as const },
        { name: 'R1', value: '10k', package: '0402', layer: 'top' as const },
        { name: 'U1', value: 'STM32', package: 'QFN32', layer: 'bottom' as const }
    ];

    beforeEach(() => {
        if (root) {
            root.unmount();
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    it('renders component names with their respective layer annotations (top vs bottom)', async () => {
        const handleSelect = vi.fn();
        const handleSearchChange = vi.fn();

        await act(async () => {
            root!.render(
                <BoardSearch
                    searchQuery=""
                    onSearchChange={handleSearchChange}
                    elements={mockElements}
                    onSelect={handleSelect}
                    selectedItem={null}
                />
            );
        });

        const textContent = container!.textContent || '';
        expect(textContent).toContain('C1');
        expect(textContent).toContain('(top)');
        expect(textContent).toContain('C2');
        expect(textContent).toContain('(bottom)');
    });

    it('passes unannotated element name to onSelect when clicked', async () => {
        const handleSelect = vi.fn();
        const handleSearchChange = vi.fn();

        await act(async () => {
            root!.render(
                <BoardSearch
                    searchQuery=""
                    onSearchChange={handleSearchChange}
                    elements={mockElements}
                    onSelect={handleSelect}
                    selectedItem={null}
                />
            );
        });

        // Find the element row containing C1
        const spans = Array.from(container!.querySelectorAll('span'));
        const c1Span = spans.find(s => s.textContent?.includes('C1'));
        expect(c1Span).toBeDefined();

        const clickableRow = c1Span!.closest('div[style*="cursor: pointer"]') as HTMLElement;
        expect(clickableRow).toBeDefined();

        await act(async () => {
            clickableRow.click();
        });

        expect(handleSelect).toHaveBeenCalledWith('element', 'C1');
    });

    it('allows searching by layer name or full annotated label', async () => {
        const handleSelect = vi.fn();
        const handleSearchChange = vi.fn();

        // Search for "bottom"
        await act(async () => {
            root!.render(
                <BoardSearch
                    searchQuery="bottom"
                    onSearchChange={handleSearchChange}
                    elements={mockElements}
                    onSelect={handleSelect}
                    selectedItem={null}
                />
            );
        });

        let text = container!.textContent || '';
        expect(text).toContain('C2');
        expect(text).toContain('U1');
        expect(text).not.toContain('C1');
        expect(text).not.toContain('R1');

        // Search for "C1 (top)"
        await act(async () => {
            root!.render(
                <BoardSearch
                    searchQuery="C1 (top)"
                    onSearchChange={handleSearchChange}
                    elements={mockElements}
                    onSelect={handleSelect}
                    selectedItem={null}
                />
            );
        });

        text = container!.textContent || '';
        expect(text).toContain('C1');
        expect(text).not.toContain('C2');
    });
});
