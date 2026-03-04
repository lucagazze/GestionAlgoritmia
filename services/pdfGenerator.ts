
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Proposal, ProposalItem, Contractor } from '../types';
import { formatMoney } from '../utils/currency';

// ======================================
// HELPERS (shared)
// ======================================
const loadLogo = async (): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = '/logo.png';
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
};

const addHeader = async (doc: jsPDF, title: string, subtitle: string) => {
    try {
        const logoImg = await loadLogo();
        const maxW = 40, maxH = 15;
        const scale = Math.min(maxW / logoImg.width, maxH / logoImg.height);
        doc.addImage(logoImg, 'PNG', 14, 12, logoImg.width * scale, logoImg.height * scale);
    } catch {
        (doc as any).setFont('helvetica', 'bold');
        (doc as any).setFontSize(22);
        (doc as any).setTextColor(0, 0, 0);
        doc.text('ALGORITMIA', 14, 20);
    }
    (doc as any).setFontSize(10);
    (doc as any).setFont('helvetica', 'normal');
    (doc as any).setTextColor(100);
    doc.text(subtitle, 14, 28);
};

// ======================================
// EXISTING PROPOSAL PDF (unchanged)
// ======================================
export const generateProposalPDF = async (proposal: Proposal) => {
    const doc: any = new jsPDF();
    const clientName = proposal.client?.name || 'Cliente';
    const industry = proposal.client?.industry || '';

    await addHeader(doc, 'Algoritmia', 'Desarrollo de Software & Growth');

    doc.setDrawColor(240);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(14, 35, 180, 25, 3, 3, 'FD');

    doc.setFontSize(8); doc.setTextColor(150); doc.text('PREPARADO PARA', 20, 42);
    doc.setFontSize(14); doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.text(clientName, 20, 50);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(80); doc.text(industry, 20, 56);
    doc.text(new Date(proposal.createdAt).toLocaleDateString(), 180, 20, { align: 'right' });

    let yPos = 70;

    if (proposal.objective || proposal.currentSituation) {
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
        doc.text('Plan Estratégico', 14, yPos); yPos += 5;
        doc.setDrawColor(230); doc.line(14, yPos, 194, yPos); yPos += 8;

        if (proposal.currentSituation && proposal.objective) {
            const colWidth = 85, gap = 10, startX2 = 14 + colWidth + gap;
            doc.setFontSize(8); doc.setTextColor(150); doc.text('SITUACIÓN ACTUAL (Punto A)', 14, yPos);
            doc.setFontSize(9); doc.setTextColor(80); doc.setFont('helvetica', 'normal');
            const splitSit = doc.splitTextToSize(proposal.currentSituation, colWidth);
            doc.text(splitSit, 14, yPos + 5);
            doc.setFontSize(8); doc.setTextColor(150); doc.text('OBJETIVO (Punto B)', startX2, yPos);
            doc.setFontSize(9); doc.setTextColor(0); doc.setFont('helvetica', 'bold');
            const splitObj = doc.splitTextToSize(proposal.objective, colWidth);
            doc.text(splitObj, startX2, yPos + 5);
            yPos += Math.max(splitSit.length * 4.5, splitObj.length * 4.5) + 15;
        }
    }

    doc.autoTable({
        startY: yPos,
        head: [['Servicio', 'Tipo', 'Inversión']],
        body: proposal.items.map(s => [
            s.serviceSnapshotName + (s.serviceSnapshotDescription ? `\n${s.serviceSnapshotDescription}` : ''),
            s.serviceSnapshotType === 'ONE_TIME' ? 'Setup' : 'Mes',
            formatMoney(s.serviceSnapshotCost, proposal.currency)
        ]),
        styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak', valign: 'top', textColor: [100, 100, 100] },
        headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', cellPadding: 4 },
        columnStyles: { 0: { cellWidth: 110 }, 2: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } },
        theme: 'grid',
        willDrawCell: (data: any) => { if (data.section === 'body' && data.column.index === 0) { data.cell.text = []; } },
        didDrawCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 0) {
                const rawText = data.row.raw[0];
                if (rawText) {
                    const lines = (rawText as string).split('\n');
                    const x = data.cell.x + data.cell.padding('left');
                    let y = data.cell.y + data.cell.padding('top') + 3;
                    data.doc.setFont('helvetica', 'bold'); data.doc.setTextColor(0, 0, 0); data.doc.setFontSize(9);
                    data.doc.text(lines[0], x, y);
                    if (lines[1]) { y += 4; data.doc.setFont('helvetica', 'normal'); data.doc.setTextColor(100, 100, 100); data.doc.text(data.doc.splitTextToSize(lines.slice(1).join('\n'), data.cell.width - data.cell.padding('left') - data.cell.padding('right')), x, y); }
                }
            }
        }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFillColor(248, 250, 252); doc.setDrawColor(200); doc.roundedRect(120, finalY, 76, 50, 3, 3, 'FD');
    doc.setFontSize(10); doc.setTextColor(100); doc.text('Setup Inicial', 125, finalY + 10);
    doc.setFontSize(12); doc.setTextColor(0); doc.text(formatMoney(proposal.totalOneTimePrice, proposal.currency), 190, finalY + 10, { align: 'right' });
    doc.setFontSize(10); doc.setTextColor(100); doc.text('Fee Mensual', 125, finalY + 20);
    doc.setFontSize(12); doc.setTextColor(0); doc.text(formatMoney(proposal.totalRecurringPrice, proposal.currency), 190, finalY + 20, { align: 'right' });
    doc.setDrawColor(200); doc.line(125, finalY + 28, 190, finalY + 28);
    doc.setFontSize(11); doc.setTextColor(100); doc.text('TOTAL', 125, finalY + 40);
    doc.setFontSize(8); doc.text(`(${proposal.durationMonths} meses)`, 125, finalY + 44);
    doc.setFontSize(16); doc.setTextColor(0, 102, 204); doc.setFont('helvetica', 'bold');
    doc.text(formatMoney(proposal.totalContractValue, proposal.currency), 190, finalY + 42, { align: 'right' });

    doc.save(`Propuesta_${clientName.replace(/\s+/g, '_')}.pdf`);
};

// ======================================
// PARTNER PDF (unchanged)
// ======================================
export const generatePartnerPDF = async (proposal: Proposal, contractor: Contractor, items: ProposalItem[]) => {
    const doc: any = new jsPDF();
    const clientName = proposal.client?.name || 'Cliente';
    await addHeader(doc, 'Algoritmia', 'Orden de Trabajo (Partner)');
    doc.setDrawColor(240); doc.setFillColor(250, 250, 250); doc.roundedRect(14, 35, 180, 25, 3, 3, 'FD');
    doc.setFontSize(8); doc.setTextColor(150); doc.text('ORDEN PARA', 20, 42);
    doc.setFontSize(14); doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.text(contractor.name, 20, 50);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(80); doc.text(`Cliente Final: ${clientName}`, 20, 56);
    doc.text(new Date().toLocaleDateString(), 180, 20, { align: 'right' });
    doc.autoTable({
        startY: 70,
        head: [['Servicio / Entregable', 'Tipo', 'Pago Acordado']],
        body: items.map(s => [s.serviceSnapshotName + (s.serviceSnapshotDescription ? `\n${s.serviceSnapshotDescription}` : ''), s.serviceSnapshotType === 'ONE_TIME' ? 'Setup' : 'Mes', formatMoney(s.outsourcingCost || 0, proposal.currency)]),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 110 }, 2: { halign: 'right', fontStyle: 'bold' } },
        theme: 'grid'
    });
    const totalPay = items.reduce((sum, s) => sum + (s.outsourcingCost || 0), 0);
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFillColor(248, 250, 252); doc.setDrawColor(200); doc.roundedRect(120, finalY, 76, 20, 3, 3, 'FD');
    doc.setFontSize(10); doc.setTextColor(100); doc.text('TOTAL A PAGAR', 125, finalY + 13);
    doc.setFontSize(16); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
    doc.text(formatMoney(totalPay, proposal.currency), 190, finalY + 13, { align: 'right' });
    doc.save(`Orden_${contractor.name.split(' ')[0]}_${clientName}.pdf`);
};

// ======================================
// MARKETING PROPOSAL — TYPE
// ======================================
export interface MarketingProposalData {
    clientName: string;
    clientIndustry: string;
    clientWebsite: string;
    clientLocation: string;
    clientCompetitors: string;
    clientDifferential: string;
    clientSocialPresence: string;
    clientAvgTicket: number;
    clientMonthlySales: number;
    proposalObjective: string;
    targetRevenue: string;
    timeframe: string;
    platforms: string;
    dailyAdBudget: string;
    targetAudience: string;
    recommendationText?: string;
    painPoint: string;
    positioning: string;
    agencyName: string;
    agencyWebsite: string;
    proposalLanguage: string;
    includeCTA: boolean;
    includeTerms: boolean;
    brandColor: string;
    numInitialAds: number;
    plans: { name: string; price: number; includes: string[] }[];
    excludedFromService: string;
    contractConditions: string;
    avgTicket: number;
    showThreeScenarios: boolean;
    scenarios: { label: string; cpa: number; newSales: number }[];
}

// ======================================
// MARKETING PROPOSAL PDF
// Color spec (PROMPT MAESTRO)
// ======================================
const C = {
    NEGRO:        [15, 23, 42]      as [number,number,number],  // Slate 900
    TABLE_HEAD:   [30, 58, 138]     as [number,number,number],  // Blue 900 (Professional Default)
    ALT_ROW:      [248, 250, 252]   as [number,number,number],  // Slate 50
    BORDER:       [226, 232, 240]   as [number,number,number],  // Slate 200
    BODY:         [51, 65, 85]      as [number,number,number],  // Slate 700
    GRIS_SUB:     [100, 116, 139]   as [number,number,number],  // Slate 500
    BLANCO:       [255, 255, 255]   as [number,number,number],
    VERDE:        [16, 185, 129]    as [number,number,number],  // Emerald 500
    ACCENT:       [79, 70, 229]     as [number,number,number],  // Indigo 600
};

// US Letter in points, 1" margins
const PW = 612, PH = 792;
const ML = 72, MR = 72;
const MT = 72;
const CW = PW - ML - MR; // 468pt

export const generateMarketingProposalPDF = async (d: MarketingProposalData): Promise<void> => {
    const doc: any = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
    let monthlyBudget = 0;
    if (typeof d.dailyAdBudget === 'string') {
        // Simple heuristic to extract a number if possible, or leave 0
        const match = d.dailyAdBudget.match(/\d+/);
        if (match) monthlyBudget = Number(match[0]) * 30;
    } else {
        monthlyBudget = (d.dailyAdBudget || 0) * 30;
    }
    const dateStr = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    const capDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    let y = MT;

    // ── Helpers ──────────────────────────────────────
    const F = (style: 'bold' | 'normal' | 'italic', size: number, color: [number,number,number]) => {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
        doc.setTextColor(...color);
    };

    const checkY = (needed: number) => {
        if (y + needed > PH - MT - 28) { doc.addPage(); y = MT; }
    };

    // Section title: 14pt bold BLUE UPPERCASE + thick short accent underline
    const sectionTitle = (text: string) => {
        checkY(30);
        F('bold', 14, C.TABLE_HEAD);
        doc.text(text.toUpperCase(), ML, y);
        doc.setDrawColor(...C.ACCENT);
        doc.setLineWidth(2);
        doc.line(ML, y + 4, ML + 40, y + 4);
        doc.setLineWidth(0.2);
        y += 20;
    };

    // Subsection title: 11pt bold black
    const subTitle = (text: string) => {
        checkY(18);
        F('bold', 11, C.NEGRO);
        doc.text(text, ML, y);
        y += 15;
    };

    // Body text
    const bodyText = (text: string, indent = 0) => {
        F('normal', 11, C.BODY);
        const lines = doc.splitTextToSize(text, CW - indent);
        checkY(lines.length * 14);
        doc.text(lines, ML + indent, y);
        y += lines.length * 14 + 4;
    };

    // ▶ bullet
    const bullet = (text: string) => {
        checkY(15);
        F('normal', 10, C.ACCENT);
        doc.text('\u25B6', ML + 8, y);
        F('normal', 11, C.BODY);
        const lines = doc.splitTextToSize(text, CW - 24);
        doc.text(lines, ML + 22, y);
        y += lines.length * 14 + 3;
    };

    // ✔ checkmark bullet
    const checkItem = (text: string) => {
        checkY(15);
        F('normal', 11, C.VERDE);
        doc.text('✔', ML + 8, y);
        F('normal', 11, C.BODY);
        const lines = doc.splitTextToSize(text, CW - 24);
        doc.text(lines, ML + 22, y);
        y += lines.length * 14 + 3;
    };

    // 2-column label|value table
    const twoColTable = (rows: [string, string][], lw = 160) => {
        const rw = CW - lw;
        rows.forEach((row, ri) => {
            const rh = 22;
            checkY(rh);
            // Left label — ALT_ROW bg
            doc.setFillColor(...(ri % 2 === 0 ? C.ALT_ROW : C.BLANCO));
            doc.setDrawColor(...C.BORDER);
            doc.rect(ML, y, lw, rh, 'FD');
            F('bold', 10, C.NEGRO);
            doc.text(row[0], ML + 6, y + 14);
            // Right value
            doc.setFillColor(...(ri % 2 === 0 ? C.BLANCO : C.ALT_ROW));
            doc.rect(ML + lw, y, rw, rh, 'FD');
            F('normal', 10, C.BODY);
            const vLines = doc.splitTextToSize(row[1] || '—', rw - 10);
            doc.text(vLines[0], ML + lw + 6, y + 14);
            y += rh;
        });
        y += 12;
    };

    // Generic multi-column table with dark header
    const multiColTable = (headers: string[], rows: (string | boolean)[][], widths: number[]) => {
        const rh = 22;
        checkY(rh);
        // Header
        let cx = ML;
        headers.forEach((h, i) => {
            doc.setFillColor(...C.TABLE_HEAD);
            doc.setDrawColor(...C.BORDER);
            doc.rect(cx, y, widths[i], rh, 'FD');
            F('bold', 10, C.BLANCO);
            doc.text(h, cx + widths[i] / 2, y + 15, { align: 'center' });
            cx += widths[i];
        });
        y += rh;

        rows.forEach((row, ri) => {
            checkY(rh);
            cx = ML;
            row.forEach((cell, ci) => {
                const bg = ri % 2 === 0 ? C.BLANCO : C.ALT_ROW;
                doc.setFillColor(...bg);
                doc.setDrawColor(...C.BORDER);
                doc.rect(cx, y, widths[ci], rh, 'FD');
                if (typeof cell === 'boolean') {
                    F('bold', 11, cell ? C.VERDE : C.GRIS_SUB);
                    doc.text(cell ? '✓' : '—', cx + widths[ci] / 2, y + 15, { align: 'center' });
                } else {
                    F('normal', 10, C.BODY);
                    const lines = doc.splitTextToSize(cell || '—', widths[ci] - 10);
                    doc.text(lines[0], cx + widths[ci] / 2, y + 15, { align: 'center' });
                }
                cx += widths[ci];
            });
            y += rh;
        });
        y += 12;
    };

    // Footer on current page
    const addFooter = () => {
        F('normal', 9, C.GRIS_SUB);
        doc.text('Algoritmia | algoritmiadesarrollos.com.ar', PW / 2, PH - 20, { align: 'center' });
    };

    // =========================================
    // PÁGINA 1 — PORTADA
    // =========================================

    const coverStartY = 240;

    // "ALGORITMIA" centered top
    F('bold', 28, C.NEGRO);
    doc.text('ALGORITMIA', PW / 2, coverStartY, { align: 'center' });

    // Subheader line
    F('normal', 11, C.GRIS_SUB);
    doc.text(`ALGORITMIA | Propuesta Digital para ${d.clientName} | ${capDate}`, PW / 2, coverStartY + 22, { align: 'center' });

    // Divider
    doc.setDrawColor(...C.ACCENT); doc.setLineWidth(1.5);
    doc.line(ML + 100, coverStartY + 40, PW - MR - 100, coverStartY + 40);
    doc.setLineWidth(0.2);

    // Main title
    F('bold', 28, C.TABLE_HEAD);
    doc.text('PROPUESTA DE PUBLICIDAD DIGITAL', PW / 2, coverStartY + 100, { align: 'center' });

    // Client name as subtitle
    F('bold', 16, C.NEGRO);
    doc.text(d.clientName, PW / 2, coverStartY + 130, { align: 'center' });

    // Tagline
    const tagline = d.proposalObjective
        ? doc.splitTextToSize(d.proposalObjective, CW * 0.78)[0]
        : `Estrategia ${String(d.platforms || 'Meta Ads').split(',')[0]} para potenciar ventas online`;
    F('italic', 12, C.GRIS_SUB);
    doc.text(tagline, PW / 2, coverStartY + 155, { align: 'center' });

    // Footer info on cover
    F('normal', 11, C.BODY);
    doc.text(`Preparado por Algoritmia • ${capDate}`, PW / 2, coverStartY + 260, { align: 'center' });
    F('normal', 10, C.GRIS_SUB);
    doc.text('algoritmiadesarrollos.com.ar', PW / 2, coverStartY + 280, { align: 'center' });
    addFooter();

    // =========================================
    // PÁGINA 2 — EL OBJETIVO + SOBRE EL NEGOCIO + LA ESTRATEGIA
    // =========================================
    doc.addPage(); y = MT;

    sectionTitle('El Objetivo');

    // Objective paragraph in bold
    F('normal', 11, C.BODY);
    const objText = d.proposalObjective ||
        `El objetivo es hacer crecer las ventas de ${d.clientName} de forma rentable usando publicidad digital. ${d.targetRevenue ? `Meta: ${d.targetRevenue}.` : ''}`;
    const objLines = doc.splitTextToSize(objText, CW);
    doc.text(objLines, ML, y);
    y += objLines.length * 14 + 10;

    if (d.clientDifferential) {
        subTitle('Tu ventaja competitiva');
        bodyText(d.clientDifferential);
    }
    y += 6;

    sectionTitle('Sobre el Negocio');
    twoColTable([
        ['Negocio',        d.clientName || '—'],
        ['Producto',       d.clientIndustry || '—'],
        ['Mercado',        d.clientLocation || '—'],
        ['Tienda online',  d.clientWebsite || '—'],
        ['Precio promedio',d.clientAvgTicket ? `USD ${d.clientAvgTicket}` : '—'],
        ['Ventas actuales',d.clientMonthlySales ? `USD ${d.clientMonthlySales.toLocaleString()}/mes` : '—'],
    ]);

    checkY(50);
    sectionTitle('La Estrategia');
    twoColTable([
        ['Plataforma',        d.platforms || '—'],
        ['Público objetivo',  d.targetAudience || '—'],
        ['Punto de dolor',    d.painPoint || '—'],
        ['Posicionamiento',   d.positioning || '—'],
        ['Inversión inicial sugerida', d.dailyAdBudget ? `${d.dailyAdBudget}` : '—'],
    ]);

    subTitle('Método de trabajo');
    bullet('Semanas 1 y 2: Puesta a punto, configuración de cuentas, instalación de Pixel y recolección de contenido activo.');
    bullet('Semanas 3 y 4: Lanzamiento de los anuncios iniciales. Monitoreo y prueba de efectividad.');
    bullet('Mes 2 en adelante: Ciclo de optimización continua — iteración de creatividades, ajuste de presupuestos.');
    bullet('Mes 3: Etapa de escalado sobre estrategias validadas e incursión en más perfiles de audiencia.');
    addFooter();

    // SE ELIMINARON LOS ESCENARIOS POR PEDIDO DEL USUARIO

    // =========================================
    // PÁGINA 4 — PLAN DE ACCIÓN MES 1 + MES 2
    // =========================================
    doc.addPage(); y = MT;
    sectionTitle('Plan de Acción a 3 Meses');

    const planW = [90, 210, 168]; // Período | Acciones | Qué vas a ver  total = 468

    const renderMonth = (title: string, expectativa: string, rows: string[][]) => {
        checkY(50);
        subTitle(title);

        // Table header
        checkY(22);
        let cx = ML;
        ['Período', 'Acciones', 'Qué vas a ver'].forEach((h, i) => {
            doc.setFillColor(...C.TABLE_HEAD); doc.setDrawColor(...C.BORDER);
            doc.rect(cx, y, planW[i], 22, 'FD');
            F('bold', 10, C.BLANCO);
            doc.text(h, cx + planW[i] / 2, y + 15, { align: 'center' });
            cx += planW[i];
        });
        y += 22;

        rows.forEach((row, ri) => {
            const rh = 24;
            checkY(rh);
            cx = ML;
            row.forEach((cell, ci) => {
                doc.setFillColor(...(ri % 2 === 0 ? C.BLANCO : C.ALT_ROW));
                doc.setDrawColor(...C.BORDER);
                doc.rect(cx, y, planW[ci], rh, 'FD');
                F('normal', 9, C.BODY);
                const t = doc.splitTextToSize(cell, planW[ci] - 10);
                doc.text(t[0], cx + 6, y + 15);
                cx += planW[ci];
            });
            y += rh;
        });
        y += 8;

        F('italic', 10, C.GRIS_SUB);
        const expLines = doc.splitTextToSize(`Expectativa ${title}: ${expectativa}`, CW);
        checkY(expLines.length * 14);
        doc.text(expLines, ML, y);
        y += expLines.length * 14 + 16;
    };

    renderMonth(
        'Mes 1 — Lanzamiento y Aprendizaje',
        `El primer mes es de puesta a punto y recolección de datos. Las campañas se activan, el algoritmo aprende y empezamos a identificar qué audiencias y creativos conectan mejor con los compradores de ${d.clientName || 'tu negocio'}.`,
        [
            ['Semana 1', 'Configuración de cuentas, Pixel, Google Tag Manager y estructura de campañas.', 'Infraestructura lista para lanzar sin errores de tracking.'],
            ['Semana 2', 'Lanzamiento de los anuncios iniciales en ' + (d.platforms || 'Meta Ads') + '.', 'Primeros datos reales: CTR, CPM, primeros resultados.'],
            ['Semana 3', 'Análisis intermedio. Pausa de creativos de bajo rendimiento.', 'CPA identificado. Tendencias claras de qué funciona.'],
            ['Semana 4', 'Primer escalado y renovación de creativos. Reporte mensual.', 'Resultados del mes y plan concreto para el mes 2.'],
        ]
    );

    renderMonth(
        'Mes 2 — Optimización y Crecimiento',
        'Con los datos del mes 1 optimizamos a fondo: reducimos el costo por venta, escalamos lo que funciona y renovamos los creativos de menor rendimiento.',
        [
            ['Semana 5–6', 'A/B testing de copys y creatividades basado en datos del mes 1.', 'Mejora de CTR y tasa de conversión por anuncio.'],
            ['Semana 7',   'Optimización de audiencias: Lookalike, Retargeting, exclusiones.', 'Reducción del CPA respecto al mes 1.'],
            ['Semana 8',   'Ajuste de presupuesto, escalado y renovación quincenal de creativos.', 'Reporte mensual con proyección para el mes 3.'],
        ]
    );
    addFooter();

    // =========================================
    // PÁGINA 5 — MES 3 + PLANES Y PRECIOS
    // =========================================
    doc.addPage(); y = MT;

    renderMonth(
        'Mes 3 — Escalado',
        'El mes de escalar. Tomamos lo que funcionó en los primeros 2 meses y lo amplificamos. También sumamos nuevos formatos y preparamos la estrategia del siguiente trimestre.',
        [
            ['Semana 9–10', 'Escalado de campañas con mejor ROI. Nuevos creativos basados en ganadores validados.', 'Más ventas al mismo costo o menor.'],
            ['Semana 11',   'Nuevos formatos: Reels, Stories, UGC. Expansión a nuevas audiencias.', 'Mayor alcance y diversificación del tráfico.'],
            ['Semana 12',   'Cierre de trimestre, reporte completo y planificación del siguiente período.', 'Roadmap claro con datos reales para los próximos 3 meses.'],
        ]
    );

    checkY(40);
    sectionTitle('Planes y Precios');

    // Dynamic Plan columns setup
    // Available width = CW = 468. Service Column = 228 (if we have many plans, shrink it, else 228)
    const numPlans = d.plans.length > 0 ? d.plans.length : 1;
    let serviceWidth = 228;
    if (numPlans > 2) {
        serviceWidth = Math.max(140, 468 - (100 * numPlans));
    }
    const planColWidth = (468 - serviceWidth) / numPlans;

    const planW3 = [serviceWidth, ...Array(numPlans).fill(planColWidth)];
    const planHeaders3 = ['Servicio incluido', ...d.plans.map(p => p.name)];

    const allIncludes = [...new Set(d.plans.flatMap(p => p.includes))];

    // Header: service | plan 1 | plan 2 ...
    checkY(22);
    let cx = ML;
    planHeaders3.forEach((h, i) => {
        doc.setFillColor(...C.TABLE_HEAD); doc.setDrawColor(...C.BORDER);
        doc.rect(cx, y, planW3[i], 26, 'FD');
        F('bold', 10, C.BLANCO);
        const hLines = h.split('\n');
        doc.text(hLines[0], cx + planW3[i] / 2, y + (hLines.length > 1 ? 11 : 17), { align: 'center' });
        if (hLines[1]) doc.text(hLines[1], cx + planW3[i] / 2, y + 21, { align: 'center' });
        cx += planW3[i];
    });
    y += 26;

    allIncludes.forEach((inc, ri) => {
        checkY(20);
        const bg = ri % 2 === 0 ? C.BLANCO : C.ALT_ROW;
        cx = ML;
        // Service
        doc.setFillColor(...bg); doc.setDrawColor(...C.BORDER);
        doc.rect(cx, y, planW3[0], 20, 'FD');
        F('normal', 10, C.BODY);
        doc.text(inc, cx + 6, y + 13);
        cx += planW3[0];

        d.plans.forEach((plan, pi) => {
            const has = plan.includes.includes(inc);
            doc.setFillColor(...bg); doc.setDrawColor(...C.BORDER);
            doc.rect(cx, y, planW3[pi + 1], 20, 'FD');
            F('bold', 11, has ? C.VERDE : C.GRIS_SUB);
            doc.text(has ? '✓' : '—', cx + planW3[pi + 1] / 2, y + 13, { align: 'center' });
            cx += planW3[pi + 1];
        });
        y += 20;
    });

    // Price row
    checkY(24);
    cx = ML;
    const priceCells: [string, boolean][] = [['Precio mensual', true]];
    d.plans.forEach(p => priceCells.push([`USD ${p.price || 0}/mes`, false]));

    priceCells.forEach((item, i) => {
        doc.setFillColor(...C.TABLE_HEAD); doc.setDrawColor(...C.BORDER);
        doc.rect(cx, y, planW3[i], 24, 'FD');
        F('bold', 10, C.BLANCO);
        doc.text(String(item[0]), cx + planW3[i] / 2, y + 16, { align: 'center' });
        cx += planW3[i];
    });
    y += 28;

    // Investment table — n plan columns
    y += 8;
    subTitle('Inversión Total — Primer Mes');
    const invW = planW3;
    // Header
    checkY(22);
    cx = ML;
    ['', ...d.plans.map(p => p.name)].forEach((h, i) => {
        doc.setFillColor(...(i === 0 ? [200,200,200] as [number,number,number] : C.TABLE_HEAD));
        doc.setDrawColor(...C.BORDER);
        doc.rect(cx, y, invW[i], 22, 'FD');
        F('bold', 10, i === 0 ? C.NEGRO : C.BLANCO);
        if (h) doc.text(h, cx + invW[i] / 2, y + 15, { align: 'center' });
        cx += invW[i];
    });
    y += 22;

    const adsRow = ['Inversión en publicidad'];
    d.plans.forEach(() => adsRow.push(`USD ${monthlyBudget.toLocaleString()}`));

    const mgmtRow = ['Gestión Algoritmia'];
    d.plans.forEach(p => mgmtRow.push(`USD ${p.price || 0}`));

    const totalRow = ['TOTAL PRIMER MES'];
    d.plans.forEach(p => totalRow.push(`USD ${monthlyBudget + (p.price || 0)}`));

    const invRows = [adsRow, mgmtRow, totalRow];
    invRows.forEach((row, ri) => {
        checkY(22);
        cx = ML;
        const isTotal = ri === 2;
        row.forEach((cell, ci) => {
            doc.setFillColor(...(isTotal ? C.TABLE_HEAD : ri % 2 === 0 ? C.BLANCO : C.ALT_ROW));
            doc.setDrawColor(...C.BORDER);
            doc.rect(cx, y, invW[ci], 22, 'FD');
            F(isTotal ? 'bold' : ci === 0 ? 'bold' : 'normal', 10, isTotal ? C.BLANCO : C.BODY);
            doc.text(cell, ci === 0 ? cx + 6 : cx + invW[ci] / 2, y + 15, { align: ci === 0 ? 'left' : 'center' });
            cx += invW[ci];
        });
        y += 22;
    });
    y += 10;

    // Recommendation paragraph
    F('normal', 11, C.BODY);
    const recText = `Recomendamos el Plan Completo porque incluye la edición de imágenes y videos, lo que nos da control total sobre los creativos y nos permite iterar más rápido sin depender de terceros. En un negocio como ${d.clientName || 'el tuyo'}, donde ${d.painPoint || 'la diferenciación visual es clave'}, la calidad del creativo es uno de los principales factores que determina el costo por venta.`;
    const recLines = doc.splitTextToSize(recText, CW);
    checkY(recLines.length * 14);
    doc.text(recLines, ML, y);
    y += recLines.length * 14 + 10;
    addFooter();

    // =========================================
    // PÁGINA 6 — LO QUE NECESITAMOS PARA EMPEZAR
    // =========================================
    doc.addPage(); y = MT;
    sectionTitle('Lo que Necesitamos para Empezar');

    const needs = [
        'Acceso de administrador al Meta Business Manager de la cuenta publicitaria.',
        'Acceso a Google Ads y Google Analytics / Google Tag Manager (si ya tiene cuenta).',
        'Acceso al sitio web o tienda online para instalar o verificar el Pixel de conversión.',
        'Material creativo: fotos y videos del producto o servicio en la mayor resolución posible.',
        'Información del producto: precios, beneficios principales, propuesta de valor y diferencial.',
        'Brief de marca: colores, tipografías, estilo visual y tono de comunicación preferido.',
        'Cuenta de WhatsApp Business configurada para capturar consultas (recomendado).',
    ];

    needs.forEach(need => checkItem(need));

    y += 16;
    F('bold', 12, C.NEGRO);
    doc.text('Listos para arrancar cuando vos quieras.', ML, y);

    addFooter();

    // Footer on all pages
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        // Page number only (footer text already added per page)
        F('normal', 9, C.GRIS_SUB);
        doc.text(`${i}`, PW - MR, PH - 20, { align: 'right' });
    }

    doc.save(`Propuesta_${d.clientName.replace(/\s+/g, '_')}_Algoritmia.pdf`);
};
