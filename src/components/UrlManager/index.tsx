import { useEffect, useRef } from 'react';
import { useAppState } from '../../store/useAppState';
import { usePcbStore } from '../../store/usePcbStore';
import { useReworkStore } from '../../store/useReworkStore';

const getNormalizedPath = () => {
    if (typeof window === 'undefined') return '/';
    let path = window.location.pathname;
    
    // Explicitly handle GitHub pages repository name masking, even in DEV mode (case-insensitive)
    const baseMatch = path.match(/^\/rework-tracker(\/|$)/i);
    if (baseMatch) {
        path = path.slice(baseMatch[0].length);
        if (!path.startsWith('/')) path = '/' + path;
    }
    
    let base = import.meta.env.BASE_URL || '/';
    if (base.endsWith('/')) base = base.slice(0, -1);
    if (path.startsWith(base)) {
        path = path.slice(base.length);
    }
    if (!path.startsWith('/')) path = '/' + path;
    console.log('[UrlManager] getNormalizedPath ->', { originalPath: window.location.pathname, base, path });
    return path;
};

export function UrlManager() {
    const { 
        activeTab, 
        expandedProject, 
        expandedPcb, 
        expandedRework, 
        isolatedView,
        page,
        setActiveTab,
        setExpandedProject,
        setExpandedPcb,
        setExpandedRework,
        setIsolatedView
    } = useAppState();

    const pcbs = usePcbStore(state => state.pcbs);
    const loading = usePcbStore(state => state.loading);
    const hasFetched = usePcbStore(state => state.hasFetched);

    // 1. Listen to POPSTATE to sync URL -> Store
    useEffect(() => {
        const handlePopState = () => {
            const rawPath = getNormalizedPath();
            
            // Projects
            if (rawPath.startsWith('/project/') || rawPath.startsWith('/projects/')) {
                usePcbStore.getState().resetFilters();
                useReworkStore.getState().resetFilters();
                const name = decodeURIComponent(rawPath.replace(/^\/projects?\//, ''));
                setActiveTab('projects');
                setExpandedProject(name || null);
                return;
            }
            // PCBs
            if (rawPath.startsWith('/pcb/') || rawPath.startsWith('/pcbs/')) {
                // Ignore matching /pcbs_add or /pcbs_edit forms by only matching base slash
                if (rawPath.startsWith('/pcbs_')) return; 

                useReworkStore.getState().resetFilters();
                let board = decodeURIComponent(rawPath.replace(/^\/pcbs?\//, ''));
                let isolated = false;
                if (board.endsWith('/view')) {
                    board = board.replace('/view', '');
                    isolated = true;
                }
                setActiveTab('pcbs');
                setExpandedPcb(board || null);
                setIsolatedView(isolated);
                return;
            }
            // Reworks
            if (rawPath.startsWith('/rework/') || rawPath.startsWith('/reworks/')) {
                 if (rawPath.startsWith('/reworks_')) return; 

                 const id = decodeURIComponent(rawPath.replace(/^\/reworks?\//, ''));
                 setActiveTab('reworks');
                 setExpandedRework(id || null);
                 return;
            }

            // Base Tabs
            // Use split to safely grab the first path segment regardless of leading/trailing slashes
            const pathSegments = rawPath.split('/').filter(Boolean);
            const path = pathSegments[0] || 'projects';
            
            if (path === 'crc') {
                useAppState.getState().setActiveTab('sandbox');
                useAppState.getState().setPage('sandbox');
                return;
            }
            
            const validPages = ['project', 'projects', 'pcb', 'pcbs', 'rework', 'reworks', 'owners', 'tags'];
            
            if (validPages.includes(path)) {
                // Normalize singulars
                let tab = path;
                if (tab === 'project') tab = 'projects';
                if (tab === 'pcb') tab = 'pcbs';
                if (tab === 'rework') tab = 'reworks';

                if (tab !== 'pcbs') usePcbStore.getState().resetFilters();
                if (tab !== 'reworks') useReworkStore.getState().resetFilters();
                
                setActiveTab(tab);
                setExpandedProject(null);
                setExpandedPcb(null);
                setExpandedRework(null);
                return;
            }

            if (path.length === 3 && /^[A-Za-z0-9]{3}$/.test(path)) {
                useAppState.getState().setActiveTab('pcbs');
                useAppState.getState().setExpandedPcb(`SHORT:${path}`);
                useAppState.getState().setIsolatedView(true);
                return;
            }
        };

        // Run once on mount to handle initial load
        handlePopState();

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
        // We only want this to run on mount and popstate unmount, DO NOT add store dependencies
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isInitialMount = useRef(true);

    // 2. Listen to Store -> Push/Replace URL
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        let base = import.meta.env.BASE_URL || '/';
        if (base.endsWith('/')) base = base.slice(0, -1);
        
        // Don't push state if we are inside a form view
        if (page !== activeTab && page.includes('_')) return;

        const search = window.location.search;
        let targetUrl = `${base}/${activeTab}${search}`;
        
        if (page === 'sandbox') {
            targetUrl = `${base}/crc${search}`;
        } else if (activeTab === 'projects' && expandedProject) {
            targetUrl = `${base}/projects/${encodeURIComponent(expandedProject)}${search}`;
        } else if (activeTab === 'pcbs' && expandedPcb) {
            targetUrl = `${base}/pcbs/${encodeURIComponent(expandedPcb)}${isolatedView ? '/view' : ''}${search}`;
        } else if (activeTab === 'reworks' && expandedRework) {
            targetUrl = `${base}/reworks/${encodeURIComponent(expandedRework)}${search}`;
        }

        // Only push if the resulting URL is different from the current to avoid infinite loops
        const currentPath = window.location.pathname + window.location.search;
        console.log('[UrlManager] Before PushState ->', { activeTab, page, targetUrl, currentPath, base });
        if (currentPath !== targetUrl) {
            window.history.pushState({}, '', targetUrl);
        }
    }, [activeTab, expandedProject, expandedPcb, expandedRework, isolatedView, page]);

    // 3. Strictly validate PCBs when data loads
    useEffect(() => {
        if (activeTab === 'pcbs' && expandedPcb && hasFetched && !loading) {
             if (expandedPcb.startsWith('SHORT:')) {
                 const code = expandedPcb.slice(6).toUpperCase();
                 const pcb = pcbs.find(p => p.short_code && p.short_code.toUpperCase() === code);
                 if (pcb) {
                     useAppState.getState().setPage('pcbs');
                     useAppState.getState().setExpandedPcb(pcb.board_number);
                     useAppState.getState().setIsolatedView(true);
                 } else {
                     useAppState.getState().setPage('wrong_url');
                 }
                 return;
             }
             
             const exists = pcbs.some(p => p.board_number === expandedPcb);
             if (!exists) {
                 useAppState.getState().setPage('wrong_url');
             } else {
                 useAppState.getState().setPage('pcbs');
             }
        }
    }, [activeTab, expandedPcb, pcbs, loading, hasFetched]);

    return null;
}
