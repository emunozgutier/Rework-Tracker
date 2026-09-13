#!/usr/bin/env python3
"""
create_demo_files.py — Generate lightweight demo .brd and schematic .pdf files.

Creates:
1. An Eagle XML .brd file compatible with the PCB Rework Tracker BoardViewer,
   rendering custom silkscreen text, board outline, components, pads, and traces.
2. A vector PDF schematic file showing a standard schematic border, title block,
   circuit diagram symbols (MCU, resistors, capacitors, LED), and custom text.

Zero external dependencies: runs with standard Python 3.
"""

import os
import sys
import argparse
from datetime import datetime

# ── 1. Vector Font for PCB Silkscreen Strokes (0.0 to 1.0 box) ────────────────

STROKE_FONT = {
    ' ': [],
    '-': [((0.2, 0.5), (0.8, 0.5))],
    '_': [((0.1, 0.0), (0.9, 0.0))],
    '.': [((0.4, 0.0), (0.6, 0.0))],
    ',': [((0.5, 0.1), (0.3, -0.2))],
    ':': [((0.5, 0.3), (0.5, 0.35)), ((0.5, 0.7), (0.5, 0.75))],
    ';': [((0.5, 0.2), (0.3, -0.1)), ((0.5, 0.7), (0.5, 0.75))],
    '/': [((0.1, 0.0), (0.9, 1.0))],
    '\\': [((0.1, 1.0), (0.9, 0.0))],
    '+': [((0.2, 0.5), (0.8, 0.5)), ((0.5, 0.2), (0.5, 0.8))],
    '=': [((0.2, 0.35), (0.8, 0.35)), ((0.2, 0.65), (0.8, 0.65))],
    '#': [((0.3, 0.1), (0.3, 0.9)), ((0.7, 0.1), (0.7, 0.9)), ((0.1, 0.35), (0.9, 0.35)), ((0.1, 0.65), (0.9, 0.65))],
    '&': [((0.8, 0.2), (0.2, 0.8)), ((0.2, 0.8), (0.5, 1.0)), ((0.5, 1.0), (0.7, 0.8)), ((0.7, 0.8), (0.2, 0.2)), ((0.2, 0.2), (0.6, 0.0)), ((0.6, 0.0), (0.9, 0.3))],
    '!': [((0.5, 0.3), (0.5, 1.0)), ((0.5, 0.0), (0.5, 0.1))],
    '?': [((0.2, 0.8), (0.5, 1.0)), ((0.5, 1.0), (0.8, 0.8)), ((0.8, 0.8), (0.5, 0.5)), ((0.5, 0.5), (0.5, 0.3)), ((0.5, 0.0), (0.5, 0.1))],
    '0': [((0, 0), (0, 1)), ((0, 1), (1, 1)), ((1, 1), (1, 0)), ((1, 0), (0, 0)), ((0, 0), (1, 1))],
    '1': [((0.5, 0), (0.5, 1)), ((0.2, 0.8), (0.5, 1)), ((0.2, 0), (0.8, 0))],
    '2': [((0, 1), (1, 1)), ((1, 1), (1, 0.5)), ((1, 0.5), (0, 0.5)), ((0, 0.5), (0, 0)), ((0, 0), (1, 0))],
    '3': [((0, 1), (1, 1)), ((1, 1), (1, 0)), ((1, 0), (0, 0)), ((0, 0.5), (1, 0.5))],
    '4': [((0, 1), (0, 0.5)), ((0, 0.5), (1, 0.5)), ((1, 1), (1, 0))],
    '5': [((1, 1), (0, 1)), ((0, 1), (0, 0.5)), ((0, 0.5), (1, 0.5)), ((1, 0.5), (1, 0)), ((1, 0), (0, 0))],
    '6': [((1, 1), (0, 1)), ((0, 1), (0, 0)), ((0, 0), (1, 0)), ((1, 0), (1, 0.5)), ((1, 0.5), (0, 0.5))],
    '7': [((0, 1), (1, 1)), ((1, 1), (0.4, 0))],
    '8': [((0, 0), (0, 1)), ((0, 1), (1, 1)), ((1, 1), (1, 0)), ((1, 0), (0, 0)), ((0, 0.5), (1, 0.5))],
    '9': [((1, 0.5), (0, 0.5)), ((0, 0.5), (0, 1)), ((0, 1), (1, 1)), ((1, 1), (1, 0)), ((1, 0), (0, 0))],
    'A': [((0, 0), (0, 0.7)), ((0, 0.7), (0.5, 1)), ((0.5, 1), (1, 0.7)), ((1, 0.7), (1, 0)), ((0, 0.4), (1, 0.4))],
    'B': [((0, 0), (0, 1)), ((0, 1), (0.8, 1)), ((0.8, 1), (1, 0.75)), ((1, 0.75), (0.8, 0.5)), ((0.8, 0.5), (0, 0.5)), ((0.8, 0.5), (1, 0.25)), ((1, 0.25), (0.8, 0)), ((0.8, 0), (0, 0))],
    'C': [((1, 1), (0, 1)), ((0, 1), (0, 0)), ((0, 0), (1, 0))],
    'D': [((0, 0), (0, 1)), ((0, 1), (0.7, 1)), ((0.7, 1), (1, 0.5)), ((1, 0.5), (0.7, 0)), ((0.7, 0), (0, 0))],
    'E': [((1, 1), (0, 1)), ((0, 1), (0, 0)), ((0, 0), (1, 0)), ((0, 0.5), (0.7, 0.5))],
    'F': [((1, 1), (0, 1)), ((0, 1), (0, 0)), ((0, 0.5), (0.7, 0.5))],
    'G': [((1, 1), (0, 1)), ((0, 1), (0, 0)), ((0, 0), (1, 0)), ((1, 0), (1, 0.5)), ((1, 0.5), (0.5, 0.5))],
    'H': [((0, 0), (0, 1)), ((1, 0), (1, 1)), ((0, 0.5), (1, 0.5))],
    'I': [((0.2, 1), (0.8, 1)), ((0.5, 1), (0.5, 0)), ((0.2, 0), (0.8, 0))],
    'J': [((0.8, 1), (0.8, 0.2)), ((0.8, 0.2), (0.5, 0)), ((0.5, 0), (0.2, 0.2)), ((0.2, 0.2), (0.2, 0.4))],
    'K': [((0, 0), (0, 1)), ((1, 1), (0, 0.5)), ((0, 0.5), (1, 0))],
    'L': [((0, 1), (0, 0)), ((0, 0), (1, 0))],
    'M': [((0, 0), (0, 1)), ((0, 1), (0.5, 0.5)), ((0.5, 0.5), (1, 1)), ((1, 1), (1, 0))],
    'N': [((0, 0), (0, 1)), ((0, 1), (1, 0)), ((1, 0), (1, 1))],
    'O': [((0, 0), (0, 1)), ((0, 1), (1, 1)), ((1, 1), (1, 0)), ((1, 0), (0, 0))],
    'P': [((0, 0), (0, 1)), ((0, 1), (1, 1)), ((1, 1), (1, 0.5)), ((1, 0.5), (0, 0.5))],
    'Q': [((0, 0), (0, 1)), ((0, 1), (1, 1)), ((1, 1), (1, 0)), ((1, 0), (0, 0)), ((0.6, 0.4), (1, 0))],
    'R': [((0, 0), (0, 1)), ((0, 1), (1, 1)), ((1, 1), (1, 0.5)), ((1, 0.5), (0, 0.5)), ((0.5, 0.5), (1, 0))],
    'S': [((1, 1), (0, 1)), ((0, 1), (0, 0.5)), ((0, 0.5), (1, 0.5)), ((1, 0.5), (1, 0)), ((1, 0), (0, 0))],
    'T': [((0, 1), (1, 1)), ((0.5, 1), (0.5, 0))],
    'U': [((0, 1), (0, 0)), ((0, 0), (1, 0)), ((1, 0), (1, 1))],
    'V': [((0, 1), (0.5, 0)), ((0.5, 0), (1, 1))],
    'W': [((0, 1), (0.25, 0)), ((0.25, 0), (0.5, 0.6)), ((0.5, 0.6), (0.75, 0)), ((0.75, 0), (1, 1))],
    'X': [((0, 0), (1, 1)), ((0, 1), (1, 0))],
    'Y': [((0, 1), (0.5, 0.5)), ((1, 1), (0.5, 0.5)), ((0.5, 0.5), (0.5, 0))],
    'Z': [((0, 1), (1, 1)), ((1, 1), (0, 0)), ((0, 0), (1, 0))]
}

def text_to_strokes(text, origin_x=0.0, origin_y=0.0, char_w=3.0, char_h=5.0, spacing=1.2):
    """Converts a text string into list of ((x1, y1), (x2, y2)) vector line segments."""
    lines = []
    cursor_x = origin_x
    for ch in text.upper():
        strokes = STROKE_FONT.get(ch, STROKE_FONT.get('?'))
        for (x1, y1), (x2, y2) in strokes:
            lx1 = round(cursor_x + x1 * char_w, 3)
            ly1 = round(origin_y + y1 * char_h, 3)
            lx2 = round(cursor_x + x2 * char_w, 3)
            ly2 = round(origin_y + y2 * char_h, 3)
            lines.append(((lx1, ly1), (lx2, ly2)))
        cursor_x += char_w + spacing
    return lines


# ── 2. Eagle XML .BRD Generator ───────────────────────────────────────────────

def generate_brd(output_path, text="DEMO PCB BOARD", project="DEMO", rev="1.0", width=140.0, height=90.0):
    """Generates an Eagle XML .brd file viewable in the BoardViewer canvas."""
    
    # Generate vector silkscreen lines for the custom text
    # Position text nicely centered along the top portion of the board
    text_w = len(text) * 4.2
    start_x = max(10.0, (width - text_w) / 2.0)
    start_y = height - 20.0
    text_lines = text_to_strokes(text, origin_x=0.0, origin_y=0.0, char_w=3.0, char_h=5.0, spacing=1.2)
    
    # Subtitle with project & rev
    sub_text = f"PROJECT: {project}  REV: {rev}"
    sub_lines = text_to_strokes(sub_text, origin_x=0.0, origin_y=-7.0, char_w=1.8, char_h=3.0, spacing=0.8)

    # Build XML Package for the text banner
    banner_wires_xml = []
    for (x1, y1), (x2, y2) in text_lines + sub_lines:
        banner_wires_xml.append(f'              <wire x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" width="0.3" layer="21"/>')

    # Border decorative box around text
    box_w = max(text_w + 10.0, 70.0)
    box_h = 17.0
    banner_wires_xml.append(f'              <wire x1="-5" y1="7" x2="{box_w}" y2="7" width="0.25" layer="21"/>')
    banner_wires_xml.append(f'              <wire x1="{box_w}" y1="7" x2="{box_w}" y2="-10" width="0.25" layer="21"/>')
    banner_wires_xml.append(f'              <wire x1="{box_w}" y1="-10" x2="-5" y2="-10" width="0.25" layer="21"/>')
    banner_wires_xml.append(f'              <wire x1="-5" y1="-10" x2="-5" y2="7" width="0.25" layer="21"/>')

    banner_wires_str = "\n".join(banner_wires_xml)

    # Layout coordinates for demo components
    cx = width / 2.0
    cy = 38.0

    xml_content = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE eagle SYSTEM "eagle.dtd">
<eagle version="9.6.2">
  <drawing>
    <settings>
      <setting alwaysvectorfont="no"/>
      <setting verticaltext="up"/>
    </settings>
    <grid distance="1" unitdist="mm" unit="mm" style="lines" multiple="1" display="no" altdistance="0.1" altunitdist="mm" altunit="mm"/>
    <layers>
      <layer number="1" name="Top" color="4" fill="1" visible="yes" active="yes"/>
      <layer number="16" name="Bottom" color="1" fill="1" visible="yes" active="yes"/>
      <layer number="17" name="Pads" color="2" fill="1" visible="yes" active="yes"/>
      <layer number="18" name="Vias" color="2" fill="1" visible="yes" active="yes"/>
      <layer number="20" name="Dimension" color="15" fill="1" visible="yes" active="yes"/>
      <layer number="21" name="tPlace" color="7" fill="1" visible="yes" active="yes"/>
      <layer number="22" name="bPlace" color="7" fill="1" visible="yes" active="yes"/>
    </layers>
    <board>
      <plain>
        <!-- Board Outline Dimension (Layer 20) -->
        <wire x1="0" y1="0" x2="{width}" y2="0" width="0.3" layer="20"/>
        <wire x1="{width}" y1="0" x2="{width}" y2="{height}" width="0.3" layer="20"/>
        <wire x1="{width}" y1="{height}" x2="0" y2="{height}" width="0.3" layer="20"/>
        <wire x1="0" y1="{height}" x2="0" y2="0" width="0.3" layer="20"/>
      </plain>
      <libraries>
        <library name="demo_lib">
          <packages>
            <!-- Custom Text Banner Package -->
            <package name="TEXT_BANNER">
{banner_wires_str}
            </package>
            <!-- 0603 Resistor Footprint -->
            <package name="R0603">
              <smd name="1" x="-0.85" y="0" dx="0.8" dy="0.8" layer="1"/>
              <smd name="2" x="0.85" y="0" dx="0.8" dy="0.8" layer="1"/>
              <wire x1="-1.3" y1="0.6" x2="1.3" y2="0.6" width="0.15" layer="21"/>
              <wire x1="1.3" y1="0.6" x2="1.3" y2="-0.6" width="0.15" layer="21"/>
              <wire x1="1.3" y1="-0.6" x2="-1.3" y2="-0.6" width="0.15" layer="21"/>
              <wire x1="-1.3" y1="-0.6" x2="-1.3" y2="0.6" width="0.15" layer="21"/>
            </package>
            <!-- 0603 Capacitor Footprint -->
            <package name="C0603">
              <smd name="1" x="-0.85" y="0" dx="0.8" dy="0.8" layer="1"/>
              <smd name="2" x="0.85" y="0" dx="0.8" dy="0.8" layer="1"/>
              <wire x1="-1.3" y1="0.6" x2="1.3" y2="0.6" width="0.15" layer="21"/>
              <wire x1="1.3" y1="0.6" x2="1.3" y2="-0.6" width="0.15" layer="21"/>
              <wire x1="1.3" y1="-0.6" x2="-1.3" y2="-0.6" width="0.15" layer="21"/>
              <wire x1="-1.3" y1="-0.6" x2="-1.3" y2="0.6" width="0.15" layer="21"/>
            </package>
            <!-- QFP-16 Microcontroller Footprint -->
            <package name="QFP16">
              <smd name="1" x="-4.5" y="1.5" dx="1.2" dy="0.5" layer="1"/>
              <smd name="2" x="-4.5" y="0.5" dx="1.2" dy="0.5" layer="1"/>
              <smd name="3" x="-4.5" y="-0.5" dx="1.2" dy="0.5" layer="1"/>
              <smd name="4" x="-4.5" y="-1.5" dx="1.2" dy="0.5" layer="1"/>
              <smd name="5" x="-1.5" y="-4.5" dx="0.5" dy="1.2" layer="1"/>
              <smd name="6" x="-0.5" y="-4.5" dx="0.5" dy="1.2" layer="1"/>
              <smd name="7" x="0.5" y="-4.5" dx="0.5" dy="1.2" layer="1"/>
              <smd name="8" x="1.5" y="-4.5" dx="0.5" dy="1.2" layer="1"/>
              <smd name="9" x="4.5" y="-1.5" dx="1.2" dy="0.5" layer="1"/>
              <smd name="10" x="4.5" y="-0.5" dx="1.2" dy="0.5" layer="1"/>
              <smd name="11" x="4.5" y="0.5" dx="1.2" dy="0.5" layer="1"/>
              <smd name="12" x="4.5" y="1.5" dx="1.2" dy="0.5" layer="1"/>
              <smd name="13" x="1.5" y="4.5" dx="0.5" dy="1.2" layer="1"/>
              <smd name="14" x="0.5" y="4.5" dx="0.5" dy="1.2" layer="1"/>
              <smd name="15" x="-0.5" y="4.5" dx="0.5" dy="1.2" layer="1"/>
              <smd name="16" x="-1.5" y="4.5" dx="0.5" dy="1.2" layer="1"/>
              <wire x1="-3.5" y1="3.5" x2="3.5" y2="3.5" width="0.2" layer="21"/>
              <wire x1="3.5" y1="3.5" x2="3.5" y2="-3.5" width="0.2" layer="21"/>
              <wire x1="3.5" y1="-3.5" x2="-3.5" y2="-3.5" width="0.2" layer="21"/>
              <wire x1="-3.5" y1="-3.5" x2="-3.5" y2="3.5" width="0.2" layer="21"/>
              <wire x1="-3.0" y1="2.5" x2="-2.5" y2="3.0" width="0.2" layer="21"/>
            </package>
            <!-- 0805 LED Footprint -->
            <package name="LED0805">
              <smd name="A" x="-1.0" y="0" dx="0.9" dy="1.1" layer="1"/>
              <smd name="C" x="1.0" y="0" dx="0.9" dy="1.1" layer="1"/>
              <wire x1="-1.6" y1="0.8" x2="1.6" y2="0.8" width="0.15" layer="21"/>
              <wire x1="1.6" y1="0.8" x2="1.6" y2="-0.8" width="0.15" layer="21"/>
              <wire x1="1.6" y1="-0.8" x2="-1.6" y2="-0.8" width="0.15" layer="21"/>
              <wire x1="-1.6" y1="-0.8" x2="-1.6" y2="0.8" width="0.15" layer="21"/>
            </package>
            <!-- 4-Pin Header Connector Footprint -->
            <package name="HDR4">
              <pad name="1" x="-3.81" y="0" drill="0.9" diameter="1.8"/>
              <pad name="2" x="-1.27" y="0" drill="0.9" diameter="1.8"/>
              <pad name="3" x="1.27" y="0" drill="0.9" diameter="1.8"/>
              <pad name="4" x="3.81" y="0" drill="0.9" diameter="1.8"/>
              <wire x1="-5.08" y1="1.5" x2="5.08" y2="1.5" width="0.2" layer="21"/>
              <wire x1="5.08" y1="1.5" x2="5.08" y2="-1.5" width="0.2" layer="21"/>
              <wire x1="5.08" y1="-1.5" x2="-5.08" y2="-1.5" width="0.2" layer="21"/>
              <wire x1="-5.08" y1="-1.5" x2="-5.08" y2="1.5" width="0.2" layer="21"/>
            </package>
          </packages>
        </library>
      </libraries>
      <elements>
        <!-- Custom Silkscreen Text Banner Element -->
        <element name="TXT1" library="demo_lib" package="TEXT_BANNER" x="{start_x}" y="{start_y}" value="BANNER"/>
        <!-- Demo Components -->
        <element name="U1" library="demo_lib" package="QFP16" x="{cx}" y="{cy}" value="MCU-DEMO"/>
        <element name="R1" library="demo_lib" package="R0603" x="{cx - 25.0}" y="{cy}" value="10k"/>
        <element name="R2" library="demo_lib" package="R0603" x="{cx + 25.0}" y="{cy}" value="1k"/>
        <element name="C1" library="demo_lib" package="C0603" x="{cx}" y="{cy + 16.0}" value="100nF"/>
        <element name="C2" library="demo_lib" package="C0603" x="{cx}" y="{cy - 16.0}" value="10uF"/>
        <element name="D1" library="demo_lib" package="LED0805" x="{cx + 38.0}" y="{cy}" value="GREEN"/>
        <element name="J1" library="demo_lib" package="HDR4" x="20.0" y="{cy}" value="POWER/DATA"/>
      </elements>
      <signals>
        <signal name="GND">
          <wire x1="16.19" y1="{cy}" x2="{cx - 25.85}" y2="{cy - 10.0}" width="0.5" layer="16"/>
          <wire x1="{cx - 25.85}" y1="{cy - 10.0}" x2="{cx}" y2="{cy - 16.0}" width="0.5" layer="16"/>
          <via x="{cx - 10.0}" y="{cy - 10.0}" drill="0.6"/>
        </signal>
        <signal name="VCC">
          <wire x1="18.73" y1="{cy}" x2="{cx - 25.85}" y2="{cy}" width="0.4" layer="1"/>
          <wire x1="{cx - 24.15}" y1="{cy}" x2="{cx - 4.5}" y2="{cy + 1.5}" width="0.3" layer="1"/>
        </signal>
        <signal name="STATUS">
          <wire x1="{cx + 4.5}" y1="{cy}" x2="{cx + 24.15}" y2="{cy}" width="0.25" layer="1"/>
          <wire x1="{cx + 25.85}" y1="{cy}" x2="{cx + 37.0}" y2="{cy}" width="0.25" layer="1"/>
        </signal>
        <signal name="3V3">
          <wire x1="{cx}" y1="{cy + 4.5}" x2="{cx}" y2="{cy + 15.15}" width="0.4" layer="1"/>
        </signal>
      </signals>
    </board>
  </drawing>
</eagle>
"""
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(xml_content)


# ── 3. Pure Python Vector PDF Schematic Generator ─────────────────────────────

def escape_pdf_text(s):
    """Escapes special characters for PDF literal strings."""
    return s.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

def generate_pdf(output_path, text="DEMO SCHEMATIC", project="DEMO", rev="A0", width_pt=792, height_pt=612):
    """
    Generates a professional vector PDF schematic (Letter Landscape: 792x612 pt)
    using pure Python with standard PDF 1.4 syntax.
    """
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    # ── PostScript-like vector commands for PDF content stream ──
    stream = []
    
    # Background & Grid Frame
    m = 25  # Margin
    pw = width_pt - 2 * m
    ph = height_pt - 2 * m
    
    # 1. Outer Double Border
    stream.append("0.1 0.1 0.1 RG")  # Dark stroke
    stream.append("1.5 w")           # Line width 1.5 pt
    stream.append(f"{m} {m} {pw} {ph} re S")
    stream.append("0.5 w")
    stream.append(f"{m + 4} {m + 4} {pw - 8} {ph - 8} re S")
    
    # 2. Reference Grid Markers along borders (A-D, 1-6)
    stream.append("BT /F1 8 Tf 0.3 0.3 0.3 rg")
    # Top and bottom numbered zones
    step_x = (pw - 8) / 6.0
    for i in range(6):
        num_str = str(i + 1)
        x_pos = m + 4 + (i + 0.5) * step_x - 3
        stream.append(f"{x_pos} {height_pt - m - 2} Td ({num_str}) Tj")
        stream.append(f"0 -{ph - 5} Td ({num_str}) Tj")
        stream.append(f"-{x_pos} 0 Td")  # reset cursor x
        stream.append(f"0 {ph - 5} Td")   # reset cursor y
    
    # Left and right letter zones
    step_y = (ph - 8) / 4.0
    letters = ['D', 'C', 'B', 'A']
    for i, letter in enumerate(letters):
        y_pos = m + 4 + (i + 0.5) * step_y - 3
        stream.append(f"{m - 14} {y_pos} Td ({letter}) Tj")
        stream.append(f"{pw + 16} 0 Td ({letter}) Tj")
        stream.append(f"-{pw + 16} 0 Td")
        stream.append(f"-{m - 14} 0 Td")
    stream.append("ET")
    
    # 3. Bottom-Right Title Block
    tb_w = 260
    tb_h = 75
    tb_x = width_pt - m - 4 - tb_w
    tb_y = m + 4
    
    stream.append("0.8 w 0.2 0.2 0.2 RG")
    stream.append(f"{tb_x} {tb_y} {tb_w} {tb_h} re S")
    stream.append(f"{tb_x} {tb_y + 45} m {tb_x + tb_w} {tb_y + 45} l S")
    stream.append(f"{tb_x} {tb_y + 25} m {tb_x + tb_w} {tb_y + 25} l S")
    stream.append(f"{tb_x + 130} {tb_y} m {tb_x + 130} {tb_y + 25} l S")
    stream.append(f"{tb_x + 195} {tb_y} m {tb_x + 195} {tb_y + 25} l S")
    
    # Title Block Text
    stream.append("BT 0 0 0 rg")
    # Company / App name
    stream.append(f"/F2 9 Tf {tb_x + 8} {tb_y + 60} Td (PCB REWORK TRACKER) Tj ET")
    stream.append("BT 0 0 0 rg")
    # Title
    stream.append(f"/F2 12 Tf {tb_x + 8} {tb_y + 32} Td ({escape_pdf_text(text[:30])}) Tj ET")
    stream.append("BT 0.2 0.2 0.2 rg")
    # Labels in bottom row
    stream.append(f"/F1 7 Tf {tb_x + 8} {tb_y + 14} Td (PROJECT:) Tj ET")
    stream.append(f"BT /F2 8 Tf {tb_x + 8} {tb_y + 5} Td ({escape_pdf_text(project)}) Tj ET")
    stream.append(f"BT /F1 7 Tf {tb_x + 138} {tb_y + 14} Td (REV:) Tj ET")
    stream.append(f"BT /F2 8 Tf {tb_x + 138} {tb_y + 5} Td ({escape_pdf_text(rev)}) Tj ET")
    stream.append(f"BT /F1 7 Tf {tb_x + 203} {tb_y + 14} Td (DATE:) Tj ET")
    stream.append(f"BT /F2 7 Tf {tb_x + 203} {tb_y + 5} Td ({date_str}) Tj ET")

    # 4. Large Header / Text Banner in center
    stream.append("BT 0.1 0.2 0.45 rg")
    stream.append(f"/F2 20 Tf 60 520 Td ({escape_pdf_text(text)}) Tj ET")
    stream.append("BT 0.4 0.4 0.4 rg")
    stream.append(f"/F1 10 Tf 60 500 Td (REFERENCE SCHEMATIC DIAGRAM  --  PROJECT {escape_pdf_text(project)}  --  REV {escape_pdf_text(rev)}) Tj ET")
    stream.append("0.3 0.4 0.6 RG 1.5 w 60 490 m 730 490 l S")

    # 5. Schematic Circuit Diagram Symbols
    
    # ── [ U1: Microcontroller Block ] ──
    u1_x, u1_y, u1_w, u1_h = 320, 240, 160, 180
    stream.append(f"0.1 0.1 0.1 RG 1.2 w {u1_x} {u1_y} {u1_w} {u1_h} re S")
    # Title inside U1
    stream.append(f"BT 0 0 0 rg /F2 13 Tf {u1_x + 35} {u1_y + 155} Td (U1: MCU) Tj ET")
    stream.append(f"BT 0.3 0.3 0.3 rg /F1 8 Tf {u1_x + 28} {u1_y + 140} Td (CORTEX-M4) Tj ET")
    
    # U1 Pins (Left side)
    left_pins = [("1", "VCC", u1_y + 120), ("2", "RESET", u1_y + 90), ("3", "GPIO0", u1_y + 60), ("4", "GND", u1_y + 30)]
    for p_num, p_name, py in left_pins:
        stream.append(f"0.8 w {u1_x - 30} {py} m {u1_x} {py} l S")
        stream.append(f"BT 0.3 0.3 0.3 rg /F1 7 Tf {u1_x - 26} {py + 3} Td ({p_num}) Tj ET")
        stream.append(f"BT 0 0 0 rg /F2 8 Tf {u1_x + 5} {py - 3} Td ({p_name}) Tj ET")
        
    # U1 Pins (Right side)
    right_pins = [("8", "TXD", u1_y + 120), ("7", "RXD", u1_y + 90), ("6", "STATUS", u1_y + 60), ("5", "3V3_OUT", u1_y + 30)]
    for p_num, p_name, py in right_pins:
        stream.append(f"0.8 w {u1_x + u1_w} {py} m {u1_x + u1_w + 30} {py} l S")
        stream.append(f"BT 0.3 0.3 0.3 rg /F1 7 Tf {u1_x + u1_w + 14} {py + 3} Td ({p_num}) Tj ET")
        stream.append(f"BT 0 0 0 rg /F2 8 Tf {u1_x + u1_w - 45} {py - 3} Td ({p_name}) Tj ET")

    # ── [ J1: Power & Programming Header ] ──
    j1_x, j1_y, j1_w, j1_h = 100, 270, 70, 120
    stream.append(f"1.0 w {j1_x} {j1_y} {j1_w} {j1_h} re S")
    stream.append(f"BT /F2 10 Tf {j1_x + 12} {j1_y + 100} Td (J1: HDR) Tj ET")
    j1_pins = [("1: VBUS", j1_y + 75), ("2: D-", j1_y + 55), ("3: D+", j1_y + 35), ("4: GND", j1_y + 15)]
    for p_label, py in j1_pins:
        stream.append(f"0.8 w {j1_x + j1_w} {py} m {j1_x + j1_w + 25} {py} l S")
        stream.append(f"BT /F1 7 Tf {j1_x + 6} {py - 3} Td ({p_label}) Tj ET")

    # Wires from J1 to U1 VCC & GND
    stream.append(f"0.8 w 0 0.4 0.2 RG")  # Green wire
    stream.append(f"{j1_x + j1_w + 25} {j1_y + 75} m {u1_x - 30} {u1_y + 120} l S")
    stream.append(f"{j1_x + j1_w + 25} {j1_y + 15} m {u1_x - 30} {u1_y + 30} l S")
    stream.append(f"BT /F1 7 Tf {j1_x + j1_w + 35} {j1_y + 80} Td (+5V) Tj ET")
    stream.append(f"BT /F1 7 Tf {j1_x + j1_w + 35} {j1_y + 20} Td (GND) Tj ET")

    # ── [ R1: Pull-up Resistor ] ──
    r1_x, r1_y = 235, 330
    stream.append(f"0.8 w 0.1 0.1 0.1 RG")
    # Resistor zigzag symbol
    stream.append(f"{r1_x} {r1_y + 40} m {r1_x} {r1_y + 30} l {r1_x - 5} {r1_y + 25} l {r1_x + 5} {r1_y + 15} l {r1_x - 5} {r1_y + 5} l {r1_x + 5} {r1_y - 5} l {r1_x} {r1_y - 10} l {r1_x} {r1_y - 20} l S")
    stream.append(f"BT /F2 8 Tf {r1_x + 8} {r1_y + 10} Td (R1) Tj ET")
    stream.append(f"BT /F1 7 Tf {r1_x + 8} {r1_y} Td (10k) Tj ET")

    # ── [ C1: Decoupling Capacitor ] ──
    c1_x, c1_y = 280, 240
    stream.append(f"{c1_x} {c1_y + 25} m {c1_x} {c1_y + 5} l S")
    stream.append(f"{c1_x - 8} {c1_y + 5} m {c1_x + 8} {c1_y + 5} l S")
    stream.append(f"{c1_x - 8} {c1_y} m {c1_x + 8} {c1_y} l S")
    stream.append(f"{c1_x} {c1_y} m {c1_x} {c1_y - 20} l S")
    stream.append(f"BT /F2 8 Tf {c1_x + 10} {c1_y + 10} Td (C1) Tj ET")
    stream.append(f"BT /F1 7 Tf {c1_x + 10} {c1_y} Td (100nF) Tj ET")

    # ── [ D1: Status LED Circuit on Right ] ──
    d1_x, d1_y = 570, 300
    # Wire from STATUS pin to R2
    stream.append(f"0.8 w 0 0.4 0.2 RG")
    stream.append(f"{u1_x + u1_w + 30} {u1_y + 60} m {d1_x} {u1_y + 60} l S")
    # Resistor R2
    stream.append(f"0.8 w 0.1 0.1 0.1 RG")
    stream.append(f"{d1_x} {u1_y + 60} m {d1_x + 10} {u1_y + 60} l")
    stream.append(f"{d1_x + 15} {u1_y + 65} l {d1_x + 25} {u1_y + 55} l {d1_x + 35} {u1_y + 65} l {d1_x + 40} {u1_y + 60} l")
    stream.append(f"{d1_x + 50} {u1_y + 60} l S")
    stream.append(f"BT /F2 8 Tf {d1_x + 15} {u1_y + 72} Td (R2 1k) Tj ET")
    
    # LED Triangle & Bar
    led_x = d1_x + 70
    led_y = u1_y + 60
    stream.append(f"{d1_x + 50} {led_y} m {led_x} {led_y} l S")
    stream.append(f"{led_x} {led_y + 8} m {led_x + 12} {led_y} l {led_x} {led_y - 8} l {led_x} {led_y + 8} l S")
    stream.append(f"{led_x + 12} {led_y + 8} m {led_x + 12} {led_y - 8} l S")
    # LED arrows
    stream.append(f"{led_x + 4} {led_y + 10} m {led_x + 10} {led_y + 16} l S")
    stream.append(f"{led_x + 8} {led_y + 10} m {led_x + 14} {led_y + 16} l S")
    stream.append(f"{led_x + 12} {led_y} m {led_x + 30} {led_y} l S")
    stream.append(f"BT /F2 8 Tf {led_x} {led_y - 18} Td (D1: GREEN) Tj ET")

    # GND symbol for LED
    gnd_x = led_x + 30
    stream.append(f"{gnd_x} {led_y} m {gnd_x} {led_y - 15} l S")
    stream.append(f"{gnd_x - 8} {led_y - 15} m {gnd_x + 8} {led_y - 15} l S")
    stream.append(f"{gnd_x - 5} {led_y - 18} m {gnd_x + 5} {led_y - 18} l S")
    stream.append(f"{gnd_x - 2} {led_y - 21} m {gnd_x + 2} {led_y - 21} l S")

    # Ground connection for C1
    stream.append(f"{c1_x} {c1_y - 20} m {c1_x} {c1_y - 30} l S")
    stream.append(f"{c1_x - 8} {c1_y - 30} m {c1_x + 8} {c1_y - 30} l S")
    stream.append(f"{c1_x - 5} {c1_y - 33} m {c1_x + 5} {c1_y - 33} l S")
    stream.append(f"{c1_x - 2} {c1_y - 36} m {c1_x + 2} {c1_y - 36} l S")

    # Assemble raw PDF 1.4 binary structure
    content_str = "\n".join(stream)
    content_bytes = content_str.encode('latin1')
    
    objs = []
    # 1: Catalog
    objs.append(b'1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
    # 2: Pages list
    objs.append(b'2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
    # 3: Page definition
    page_def = f'3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width_pt} {height_pt}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n'
    objs.append(page_def.encode('latin1'))
    # 4: Stream object
    objs.append(f'4 0 obj\n<< /Length {len(content_bytes)} >>\nstream\n'.encode('latin1') + content_bytes + b'\nendstream\nendobj\n')
    # 5: Helvetica (regular)
    objs.append(b'5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')
    # 6: Helvetica-Bold
    objs.append(b'6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n')

    # Construct cross-reference table and final file
    out = b'%PDF-1.4\n'
    xref = [len(out)]
    out += objs[0]
    for o in objs[1:]:
        xref.append(len(out))
        out += o
    startxref = len(out)
    out += f'xref\n0 {len(objs) + 1}\n0000000000 65535 f \n'.encode('latin1')
    for offset in xref:
        out += f'{offset:010d} 00000 n \n'.encode('latin1')
    out += f'trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{startxref}\n%%EOF\n'.encode('latin1')

    with open(output_path, 'wb') as f:
        f.write(out)


# ── 4. Main CLI Entry Point ───────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate demo .brd and schematic .pdf files with custom text.")
    parser.add_argument(
        "-t", "--text",
        default="DEMO PCB & SCHEMATIC",
        help="Text to display on both the BRD silkscreen and the schematic diagram (default: 'DEMO PCB & SCHEMATIC')"
    )
    parser.add_argument(
        "-n", "--name",
        default="demo",
        help="Base file name without extension (default: 'demo' -> demo.brd, demo-SCH.pdf)"
    )
    parser.add_argument(
        "-o", "--output-dir",
        default=".",
        help="Directory where files will be created (default: current directory)"
    )
    parser.add_argument(
        "-p", "--project",
        default="DEMO",
        help="Project key or name (default: 'DEMO')"
    )
    parser.add_argument(
        "-r", "--rev",
        default="A0",
        help="Revision label (default: 'A0')"
    )
    parser.add_argument(
        "--width",
        type=float,
        default=140.0,
        help="Board width in mm (default: 140.0)"
    )
    parser.add_argument(
        "--height",
        type=float,
        default=90.0,
        help="Board height in mm (default: 90.0)"
    )
    parser.add_argument(
        "--brd-only",
        action="store_true",
        help="Generate only the .brd file"
    )
    parser.add_argument(
        "--sch-only",
        action="store_true",
        help="Generate only the schematic .pdf file"
    )

    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    brd_filename = f"{args.name}.brd"
    pdf_filename = f"{args.name}-SCH.pdf"

    brd_path = os.path.join(args.output_dir, brd_filename)
    pdf_path = os.path.join(args.output_dir, pdf_filename)

    print(f"=== Demo PCB & Schematic Generator ===")
    print(f"Text:      {args.text}")
    print(f"Project:   {args.project}")
    print(f"Revision:  {args.rev}")
    print(f"Output:    {os.path.abspath(args.output_dir)}")
    print()

    if not args.sch_only:
        generate_brd(brd_path, text=args.text, project=args.project, rev=args.rev, width=args.width, height=args.height)
        size_kb = os.path.getsize(brd_path) / 1024.0
        print(f"[+] BRD File:       {brd_path} ({size_kb:.1f} KB)")

    if not args.brd_only:
        generate_pdf(pdf_path, text=args.text, project=args.project, rev=args.rev)
        size_kb = os.path.getsize(pdf_path) / 1024.0
        print(f"[+] Schematic PDF:  {pdf_path} ({size_kb:.1f} KB)")

    print("\nGeneration complete!")

if __name__ == "__main__":
    main()
