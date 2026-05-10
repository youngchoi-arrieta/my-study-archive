'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────
type Lang = 'ko' | 'en' | 'es'
type PathDef = { id: string; label: string; label_en?: string; label_es?: string; color: string; x: number }
type NodeDef = {
  id: string; pathId: string
  label: string; sub: string; desc: string
  label_en?: string; sub_en?: string; desc_en?: string
  label_es?: string; sub_es?: string; desc_es?: string
  y: number; x_offset?: number; preset: string
}
type EdgeDef = {
  id: string; from: string; to: string; cross: boolean
  label: string; label_en?: string; label_es?: string
}
type TreeConfig = { paths: PathDef[]; nodes: NodeDef[]; edges: EdgeDef[] }
type Activations = Record<string, boolean>
type Selection = { type: 'node'; id: string } | { type: 'edge'; id: string } | null

const genId = () => Math.random().toString(36).slice(2, 10)
const PAD = 80
const CANVAS_H = 880

// ── Language helpers ───────────────────────────────────────────────────────
const L = {
  label: (n: NodeDef, lang: Lang) => (lang === 'en' ? n.label_en : lang === 'es' ? n.label_es : undefined) || n.label,
  sub:   (n: NodeDef, lang: Lang) => (lang === 'en' ? n.sub_en   : lang === 'es' ? n.sub_es   : undefined) || n.sub,
  desc:  (n: NodeDef, lang: Lang) => (lang === 'en' ? n.desc_en  : lang === 'es' ? n.desc_es  : undefined) || n.desc,
  path:  (p: PathDef, lang: Lang) => (lang === 'en' ? p.label_en : lang === 'es' ? p.label_es : undefined) || p.label,
  edge:  (e: EdgeDef, lang: Lang) => (lang === 'en' ? e.label_en : lang === 'es' ? e.label_es : undefined) || e.label,
}

// ── Default career config ─────────────────────────────────────────────────
const DEFAULT_CAREER: TreeConfig = {
  paths: [
    { id:'korea',     label:'⚔ 한국의 길',   label_en:'⚔ Korea',     label_es:'⚔ Corea',    color:'#f87171', x:115 },
    { id:'japan',     label:'⛩ 일본의 길',   label_en:'⛩ Japan',     label_es:'⛩ Japón',    color:'#fbbf24', x:355 },
    { id:'canada',    label:'🍁 캐나다의 길', label_en:'🍁 Canada',    label_es:'🍁 Canadá',   color:'#60a5fa', x:625 },
    { id:'australia', label:'🦘 호주의 길',   label_en:'🦘 Australia', label_es:'🦘 Australia', color:'#34d399', x:910 },
  ],
  nodes: [
    { id:'k1', pathId:'korea',     label:'전기기능사',         sub:'76점 취득',       y:720, preset:'done',
      label_en:'Electrical Craftsman',           sub_en:'Score 76 — Passed',
      label_es:'Técnico Electricista',           sub_es:'Puntuación 76 — Aprobado',
      desc:'2025년 1회 취득.', desc_en:'Obtained in 2025, Exam Round 1.', desc_es:'Obtenido en 2025, 1ª convocatoria.' },
    { id:'k2', pathId:'korea',     label:'전기기사 필기',       sub:'96점',            y:600, preset:'done',
      label_en:'Electrical Engineer Written',    sub_en:'Score 96',
      label_es:'Ing. Eléctrica Escrito',         sub_es:'Puntuación 96',
      desc:'2025년 1회 96점.', desc_en:'2025 Round 1, score 96.', desc_es:'2025, 1ª conv., 96 puntos.' },
    { id:'k3', pathId:'korea',     label:'전기기사 실기',       sub:'가채점 80점',      y:480, preset:'progress',
      label_en:'Electrical Engineer Practical',  sub_en:'Est. 80 pts',
      label_es:'Ing. Eléctrica Práctico',        sub_es:'Aprox. 80 pts',
      desc:'4/18 응시. 결과 6/12.', desc_en:'Taken 4/18. Results 6/12.', desc_es:'Examen 18/4. Resultados 12/6.' },
    { id:'k4', pathId:'korea',     label:'전기기사 취득',       sub:'결과 6/12',        y:360, preset:'pending',
      label_en:'Electrical Engineer License',    sub_en:'Results 6/12',
      label_es:'Licencia Ing. Eléctrica',        sub_es:'Resultados 12/6',
      desc:'합격 시 취득.', desc_en:'Awarded upon passing.', desc_es:'Se otorga al aprobar.' },
    { id:'k5', pathId:'korea',     label:'전기공사사 2종',      sub:'학과 5/28',        y:240, preset:'progress',
      label_en:'Type 2 Electrical Contractor',  sub_en:'Written 5/28',
      label_es:'Contratista Eléctrico Tipo 2',  sub_es:'Teórico 28/5',
      desc:'학과 5/28 CBT.', desc_en:'Written exam 5/28 CBT.', desc_es:'Examen teórico 28/5 CBT.' },
    { id:'k6', pathId:'korea',     label:'보호계전\n엔지니어',  sub:'Data Center',      y:90,  preset:'',
      label_en:'Protection Relay\nEngineer',    sub_en:'Data Center FM',
      label_es:'Ingeniero de\nRelés Protección',sub_es:'FM Data Center',
      desc:'외국계 DC FM 목표.', desc_en:'Target: foreign-affiliated data center FM.', desc_es:'Meta: FM data center empresa extranjera.' },
    { id:'j1', pathId:'japan',     label:'JLPT N4 등록',       sub:'7월 2026',         y:720, preset:'done',
      label_en:'JLPT N4 Registered',            sub_en:'July 2026',
      label_es:'JLPT N4 Registrado',            sub_es:'Julio 2026',
      desc:'2026년 7월 등록 완료.', desc_en:'Registered for July 2026.', desc_es:'Inscrito para julio 2026.' },
    { id:'j2', pathId:'japan',     label:'第2種工事士\n学科試験',sub:'5/28 하카타',      y:610, preset:'progress',
      label_en:'Type 2 Electrician\nWritten (JP)',sub_en:'5/28 Hakata',
      label_es:'Electricista Tipo 2\nTeórico (JP)',sub_es:'28/5 Hakata',
      desc:'5/28 후쿠오카 CBT.', desc_en:'5/28 Fukuoka CBT exam.', desc_es:'28/5 Fukuoka CBT.' },
    { id:'j3', pathId:'japan',     label:'第2種工事士\n取得',   sub:'',                 y:490, preset:'',
      label_en:'Type 2 Electrician\nLicense (JP)',sub_en:'',
      label_es:'Licencia Electricista\nTipo 2 (JP)',sub_es:'',
      desc:'기술시험 합격 후 취득.', desc_en:'Obtained after passing practical.', desc_es:'Se obtiene tras aprobar la parte práctica.' },
    { id:'j4', pathId:'japan',     label:'JLPT N4',             sub:'',                 y:375, preset:'',
      label_en:'JLPT N4 Passed',                sub_en:'',
      label_es:'JLPT N4 Aprobado',              sub_es:'',
      desc:'N4 합격. 기인국 비자 기반.', desc_en:'N4 pass — basis for work visa.', desc_es:'N4 aprobado — base para visa de trabajo.' },
    { id:'j5', pathId:'japan',     label:'電験3종',              sub:'',                 y:260, preset:'',
      label_en:'3rd Class Electrical\nChief Tech',sub_en:'',
      label_es:'Técnico Jefe\nEléctrico 3ª Clase',sub_es:'',
      desc:'第三種電気主任技術者.', desc_en:'3rd Class Electrical Chief Technician.', desc_es:'Técnico Jefe Eléctrico 3ª Clase.' },
    { id:'j6', pathId:'japan',     label:'JLPT N2',              sub:'',                 y:170, preset:'',
      label_en:'JLPT N2 Passed',                sub_en:'',
      label_es:'JLPT N2 Aprobado',              sub_es:'',
      desc:'N2 합격. 高度専門職 필수.', desc_en:'N2 pass — required for HSP visa.', desc_es:'N2 aprobado — requerido para visa profesional.' },
    { id:'j7', pathId:'japan',     label:'高度専門職 1호',        sub:'~80pt',            y:80,  preset:'',
      label_en:'Highly Skilled\nProfessional Visa',sub_en:'~80 pts',
      label_es:'Visa Profesional\nAltamente Calificado',sub_es:'~80 pts',
      desc:'KAIST+전기기사+N2 ≈ 80pt.', desc_en:'KAIST + Elec. Engineer + N2 ≈ 80pts.', desc_es:'KAIST + Ing. Eléctrica + N2 ≈ 80 puntos.' },
    { id:'j8', pathId:'japan',     label:'電験2종',               sub:'',                 y:5,   preset:'',
      label_en:'2nd Class Electrical\nChief Tech', sub_en:'',
      label_es:'Técnico Jefe\nEléctrico 2ª Clase',sub_es:'',
      desc:'第二種電気主任技術者.', desc_en:'2nd Class Electrical Chief Technician.', desc_es:'Técnico Jefe Eléctrico 2ª Clase.' },
    { id:'c1', pathId:'canada',    label:'워홀 초청장',           sub:'W313314277',       y:720, preset:'done',
      label_en:'Working Holiday\nInvitation',    sub_en:'W313314277',
      label_es:'Invitación\nWorking Holiday',    sub_es:'W313314277',
      desc:'캐나다 WH 초청장 수령.', desc_en:'Canada WH invitation received.', desc_es:'Invitación Working Holiday Canadá recibida.' },
    { id:'c2', pathId:'canada',    label:'지문 등록',              sub:'4/17 완료',        y:600, preset:'done',
      label_en:'Biometrics Registered',          sub_en:'Completed 4/17',
      label_es:'Biometría Registrada',           sub_es:'Completado 17/4',
      desc:'생체정보 등록 완료.', desc_en:'Biometrics registration complete.', desc_es:'Registro biométrico completo.' },
    { id:'c3', pathId:'canada',    label:'캐나다 입국',            sub:'',                 y:480, preset:'',
      label_en:'Arrive in Canada',               sub_en:'',
      label_es:'Llegada a Canadá',              sub_es:'',
      desc:'비자 발급 후 입국.', desc_en:'Enter Canada after visa issued.', desc_es:'Entrar a Canadá tras obtener la visa.' },
    { id:'c4', pathId:'canada',    label:'전기직 취업',            sub:'Equinix/CBRE',     y:360, preset:'',
      label_en:'Electrical Job\n(Data Center)',  sub_en:'Equinix/CBRE',
      label_es:'Empleo Eléctrico\n(Data Center)',sub_es:'Equinix/CBRE',
      desc:'외국계 DC FM.', desc_en:'Foreign data center FM job.', desc_es:'Trabajo FM data center empresa extranjera.' },
    { id:'c5', pathId:'canada',    label:'Red Seal',               sub:'준비',             y:230, preset:'',
      label_en:'Red Seal\nCertification',        sub_en:'Preparation',
      label_es:'Certificación\nRed Seal',        sub_es:'Preparación',
      desc:'캐나다 전국 통용 전기 자격.', desc_en:'Canada-wide electrical credential.', desc_es:'Credencial eléctrica a nivel nacional.' },
    { id:'c6', pathId:'canada',    label:'PR 신청',                sub:'Express Entry',    y:100, preset:'',
      label_en:'Permanent Residence\nApplication',sub_en:'Express Entry',
      label_es:'Solicitud de\nResidencia Permanente',sub_es:'Express Entry',
      desc:'영주권 신청.', desc_en:'Permanent residence application.', desc_es:'Solicitud de residencia permanente.' },
    { id:'a1', pathId:'australia', label:'워홀 지원',              sub:'',                 y:720, preset:'',
      label_en:'Working Holiday\nApplication',   sub_en:'',
      label_es:'Solicitud\nWorking Holiday',     sub_es:'',
      desc:'호주 WH 비자 신청.', desc_en:'Australia WH visa application.', desc_es:'Solicitud de Working Holiday Australia.' },
    { id:'a2', pathId:'australia', label:'호주 입국',              sub:'',                 y:600, preset:'',
      label_en:'Arrive in Australia',            sub_en:'',
      label_es:'Llegada a Australia',            sub_es:'',
      desc:'비자 발급 후 입국.', desc_en:'Enter Australia after visa issued.', desc_es:'Entrar a Australia tras obtener la visa.' },
    { id:'a3', pathId:'australia', label:'RPL 인증',               sub:'',                 y:480, preset:'',
      label_en:'RPL Certification',              sub_en:'',
      label_es:'Certificación RPL',             sub_es:'',
      desc:'기취득 자격 인증.', desc_en:'Recognition of Prior Learning.', desc_es:'Reconocimiento de aprendizaje previo.' },
    { id:'a4', pathId:'australia', label:'호주 전기 면허',          sub:'',                 y:360, preset:'',
      label_en:'Australian Electrical\nLicense', sub_en:'',
      label_es:'Licencia Eléctrica\nAustraliana', sub_es:'',
      desc:'주별 전기 면허.', desc_en:'State electrical license.', desc_es:'Licencia eléctrica estatal.' },
    { id:'a5', pathId:'australia', label:'PR 신청',                sub:'Skills 186',       y:220, preset:'',
      label_en:'Permanent Residence\nApplication',sub_en:'Skills 186',
      label_es:'Solicitud de\nResidencia Permanente',sub_es:'Skills 186',
      desc:'영주권 신청.', desc_en:'PR application via Skills 186.', desc_es:'Solicitud RP vía Skills 186.' },
  ],
  edges: [
    {id:'e1', from:'k1',to:'k2',cross:false,label:''},
    {id:'e2', from:'k2',to:'k3',cross:false,label:''},
    {id:'e3', from:'k3',to:'k4',cross:false,label:''},
    {id:'e4', from:'k4',to:'k5',cross:false,label:''},
    {id:'e5', from:'k5',to:'k6',cross:false,label:''},
    {id:'e6', from:'j1',to:'j2',cross:false,label:''},
    {id:'e7', from:'j2',to:'j3',cross:false,label:''},
    {id:'e8', from:'j3',to:'j4',cross:false,label:''},
    {id:'e9', from:'j4',to:'j5',cross:false,label:''},
    {id:'e10',from:'j5',to:'j6',cross:false,label:''},
    {id:'e11',from:'j6',to:'j7',cross:false,label:''},
    {id:'e12',from:'j7',to:'j8',cross:false,label:''},
    {id:'e13',from:'c1',to:'c2',cross:false,label:''},
    {id:'e14',from:'c2',to:'c3',cross:false,label:''},
    {id:'e15',from:'c3',to:'c4',cross:false,label:''},
    {id:'e16',from:'c4',to:'c5',cross:false,label:''},
    {id:'e17',from:'c5',to:'c6',cross:false,label:''},
    {id:'e18',from:'a1',to:'a2',cross:false,label:''},
    {id:'e19',from:'a2',to:'a3',cross:false,label:''},
    {id:'e20',from:'a3',to:'a4',cross:false,label:''},
    {id:'e21',from:'a4',to:'a5',cross:false,label:''},
    {id:'x1', from:'k5',to:'j2',cross:true, label:'동일 시험',  label_en:'Same Exam',         label_es:'Mismo Examen'},
    {id:'x2', from:'k4',to:'j7',cross:true, label:'+pt 기여',   label_en:'+Points',            label_es:'+Puntos'},
    {id:'x3', from:'c1',to:'a1',cross:true, label:'대안 루트',  label_en:'Alternative Route',  label_es:'Ruta Alternativa'},
    {id:'x4', from:'k6',to:'c4',cross:true, label:'역량 연계',  label_en:'Skill Transfer',     label_es:'Transferencia'},
  ],
}

// ── Default technical config ───────────────────────────────────────────────
const DEFAULT_TECHNICAL: TreeConfig = {
  paths: [
    { id:'pe', label:'⚡ 전력전자',     label_en:'⚡ Power Electronics', label_es:'⚡ Electrónica de Potencia', color:'#f472b6', x:110 },
    { id:'mc', label:'🔄 모터제어',     label_en:'🔄 Motor Control',     label_es:'🔄 Control de Motores',       color:'#fb923c', x:330 },
    { id:'ps', label:'🔌 전력계통',     label_en:'🔌 Power Systems',     label_es:'🔌 Sistemas Eléctricos',      color:'#4ade80', x:570 },
    { id:'re', label:'☀ 신재생에너지',  label_en:'☀ Renewable Energy',  label_es:'☀ Energía Renovable',        color:'#facc15', x:790 },
    { id:'ic', label:'🖥 계측제어',     label_en:'🖥 Instrumentation',   label_es:'🖥 Instrumentación',          color:'#38bdf8', x:1000 },
  ],
  nodes: [
    {id:'pe1',pathId:'pe',label:'기초 회로이론',  sub:'KAIST',  y:720,preset:'done',    label_en:'Circuit Theory Basics',      label_es:'Fundamentos de Circuitos', desc:'회로이론 기초.'},
    {id:'pe2',pathId:'pe',label:'전력변환 기초',  sub:'',        y:580,preset:'',       label_en:'Power Conversion Basics',    label_es:'Conversión de Potencia',   desc:'AC-DC, DC-AC 변환.'},
    {id:'pe3',pathId:'pe',label:'DC-DC 컨버터',   sub:'',        y:440,preset:'',       label_en:'DC-DC Converter',            label_es:'Convertidor DC-DC',        desc:'Buck, Boost, Flyback.'},
    {id:'pe4',pathId:'pe',label:'인버터 설계',    sub:'',        y:300,preset:'',       label_en:'Inverter Design',            label_es:'Diseño de Inversor',       desc:'3상 인버터 PWM.'},
    {id:'pe5',pathId:'pe',label:'SiC/GaN',        sub:'',        y:160,preset:'',       label_en:'SiC/GaN Devices',            label_es:'Dispositivos SiC/GaN',     desc:'WBG 반도체.'},
    {id:'mc1',pathId:'mc',label:'전기기기 기초',  sub:'전기기사', y:720,preset:'done',   label_en:'Electrical Machines',        label_es:'Máquinas Eléctricas',      desc:'변압기, 유도전동기.'},
    {id:'mc2',pathId:'mc',label:'BLDC 드라이브',  sub:'',        y:580,preset:'',       label_en:'BLDC Drive',                 label_es:'Controlador BLDC',         desc:'센서리스 BLDC.'},
    {id:'mc3',pathId:'mc',label:'벡터 제어 FOC',  sub:'',        y:440,preset:'',       label_en:'FOC Vector Control',         label_es:'Control Vectorial FOC',    desc:'dq 변환.'},
    {id:'mc4',pathId:'mc',label:'PMSM 제어',      sub:'',        y:300,preset:'',       label_en:'PMSM Control',               label_es:'Control PMSM',             desc:'영구자석 동기전동기.'},
    {id:'mc5',pathId:'mc',label:'전류제어기 설계', sub:'',        y:160,preset:'',       label_en:'Current Controller Design',  label_es:'Diseño Controlador Corriente', desc:'PI 전류제어기.'},
    {id:'ps1',pathId:'ps',label:'계통 기초',       sub:'전기기사', y:720,preset:'done',  label_en:'Power System Basics',        label_es:'Fundamentos de Sistemas',  desc:'전력조류 기초.'},
    {id:'ps2',pathId:'ps',label:'단락전류 해석',   sub:'',        y:580,preset:'',       label_en:'Short Circuit Analysis',     label_es:'Análisis de Cortocircuito', desc:'대칭좌표법.'},
    {id:'ps3',pathId:'ps',label:'보호계전',        sub:'관심 분야', y:440,preset:'progress',label_en:'Protection Relaying',      label_es:'Relés de Protección',      desc:'OCR/DOCR/87T.'},
    {id:'ps4',pathId:'ps',label:'파워플로우',      sub:'',        y:300,preset:'',       label_en:'Power Flow Analysis',        label_es:'Flujo de Potencia',        desc:'Newton-Raphson.'},
    {id:'ps5',pathId:'ps',label:'PSCAD 시뮬',     sub:'',        y:160,preset:'',       label_en:'PSCAD Simulation',           label_es:'Simulación PSCAD',         desc:'PSCAD/EMTDC.'},
    {id:'re1',pathId:'re',label:'태양광 PV 기초',  sub:'',        y:720,preset:'',       label_en:'Solar PV Basics',            label_es:'Fundamentos Energía Solar', desc:'PV 셀 특성.'},
    {id:'re2',pathId:'re',label:'MPPT 제어',       sub:'',        y:560,preset:'',       label_en:'MPPT Control',               label_es:'Control MPPT',             desc:'P&O, INC 알고리즘.'},
    {id:'re3',pathId:'re',label:'계통연계 인버터', sub:'',        y:380,preset:'',       label_en:'Grid-tied Inverter',         label_es:'Inversor Conectado a Red', desc:'PLL, 무효전력.'},
    {id:'re4',pathId:'re',label:'풍력 발전',       sub:'',        y:220,preset:'',       label_en:'Wind Power',                 label_es:'Energía Eólica',           desc:'DFIG/PMSG.'},
    {id:'ic1',pathId:'ic',label:'PLC 기초',        sub:'XG5000', y:720,preset:'done',    label_en:'PLC Basics',                 label_es:'Fundamentos PLC',          desc:'XG5000 프로그래밍.'},
    {id:'ic2',pathId:'ic',label:'시퀀스 제어',     sub:'',        y:570,preset:'progress',label_en:'Sequence Control',           label_es:'Control Secuencial',       desc:'MC, 인터록, 타이머.'},
    {id:'ic3',pathId:'ic',label:'SCADA/HMI',       sub:'',        y:410,preset:'',       label_en:'SCADA/HMI',                  label_es:'SCADA/HMI',                desc:'산업용 감시제어.'},
    {id:'ic4',pathId:'ic',label:'PID 제어',        sub:'',        y:250,preset:'',       label_en:'PID Control',                label_es:'Control PID',              desc:'Ziegler-Nichols.'},
    {id:'ic5',pathId:'ic',label:'분산제어 DCS',    sub:'',        y:100,preset:'',       label_en:'Distributed Control DCS',    label_es:'Control Distribuido DCS',  desc:'대형 플랜트 DCS.'},
  ],
  edges: [
    {id:'e1', from:'pe1',to:'pe2',cross:false,label:''},
    {id:'e2', from:'pe2',to:'pe3',cross:false,label:''},
    {id:'e3', from:'pe3',to:'pe4',cross:false,label:''},
    {id:'e4', from:'pe4',to:'pe5',cross:false,label:''},
    {id:'e5', from:'mc1',to:'mc2',cross:false,label:''},
    {id:'e6', from:'mc2',to:'mc3',cross:false,label:''},
    {id:'e7', from:'mc3',to:'mc4',cross:false,label:''},
    {id:'e8', from:'mc4',to:'mc5',cross:false,label:''},
    {id:'e9', from:'ps1',to:'ps2',cross:false,label:''},
    {id:'e10',from:'ps2',to:'ps3',cross:false,label:''},
    {id:'e11',from:'ps3',to:'ps4',cross:false,label:''},
    {id:'e12',from:'ps4',to:'ps5',cross:false,label:''},
    {id:'e13',from:'re1',to:'re2',cross:false,label:''},
    {id:'e14',from:'re2',to:'re3',cross:false,label:''},
    {id:'e15',from:'re3',to:'re4',cross:false,label:''},
    {id:'e16',from:'ic1',to:'ic2',cross:false,label:''},
    {id:'e17',from:'ic2',to:'ic3',cross:false,label:''},
    {id:'e18',from:'ic3',to:'ic4',cross:false,label:''},
    {id:'e19',from:'ic4',to:'ic5',cross:false,label:''},
    {id:'x1', from:'pe4',to:'mc3',cross:true,label:'인버터↔FOC', label_en:'Inverter↔FOC', label_es:'Inversor↔FOC'},
    {id:'x2', from:'ps3',to:'pe4',cross:true,label:'보호↔인버터', label_en:'Protection↔Inverter', label_es:'Protección↔Inversor'},
    {id:'x3', from:'re3',to:'pe4',cross:true,label:'공통 기술',  label_en:'Shared Tech', label_es:'Tecnología Común'},
    {id:'x4', from:'ic2',to:'mc2',cross:true,label:'시퀀스↔드라이브', label_en:'Sequence↔Drive', label_es:'Secuencia↔Driver'},
  ],
}

// ── Visual state ───────────────────────────────────────────────────────────
function visual(node: NodeDef, activations: Activations, pathColor: string) {
  const on = !!activations[node.id]
  if (on && node.preset==='done')     return {bg:'#451a03',bd:'#f59e0b',glow:'#f59e0b',ic:'✦',tc:'#fef3c7',ring:false,anim:true}
  if (on && node.preset==='progress') return {bg:'#0c1a2e',bd:'#60a5fa',glow:'#60a5fa',ic:'◐',tc:'#bfdbfe',ring:true, anim:true}
  if (on)                             return {bg:pathColor+'28',bd:pathColor,glow:pathColor,ic:'★',tc:'#ffffff',ring:false,anim:false}
  if (node.preset==='done')           return {bg:'#2c1700',bd:'#78350f',glow:'#78350f',ic:'✓',tc:'#92400e',ring:false,anim:false}
  if (node.preset==='progress')       return {bg:'#0a1220',bd:'#1e3a8a',glow:'#1e3a8a',ic:'◐',tc:'#3b82f6',ring:true, anim:false}
  if (node.preset==='pending')        return {bg:'#111827',bd:'#374151',glow:null,     ic:'○',tc:'#6b7280',ring:false,anim:false}
  return                                     {bg:'#06060e',bd:'#1e293b',glow:null,     ic:'·',tc:'#374151',ring:false,anim:false}
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function SkillTreePage() {
  const params = useParams()
  const treeType = params.type as string
  const isCareer = treeType === 'career'
  const pageTitle = isCareer ? '⚔ 경력 마일스톤' : '⚙ 기술 스택'
  const defaultConfig = isCareer ? DEFAULT_CAREER : DEFAULT_TECHNICAL
  const canvasW = isCareer ? 1080 : 1150

  const [lang, setLang] = useState<Lang>('ko')
  const [config, setConfig]           = useState<TreeConfig>(defaultConfig)
  const [activations, setActivations] = useState<Activations>({})
  const [editMode, setEditMode]       = useState(false)
  const [selection, setSelection]     = useState<Selection>(null)
  const [linkFrom, setLinkFrom]       = useState<string | null>(null)
  const [tooltip, setTooltip]         = useState<{node: NodeDef; x: number; y: number} | null>(null)
  const [saving, setSaving]           = useState(false)
  const [loaded, setLoaded]           = useState(false)
  const [showPathEditor, setShowPathEditor] = useState(false)

  // Edit form state
  const [formLang, setFormLang]       = useState<Lang>('ko')
  const [nodeForm, setNodeForm]       = useState<Partial<NodeDef>>({})
  const [edgeForm, setEdgeForm]       = useState<Partial<EdgeDef>>({})

  const dragRef = useRef<{nodeId:string; startMX:number; startMY:number; startNX:number; startNY:number} | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('skilltree_configs').select('config,activations').eq('tree_type', treeType).single()
      .then(({ data }) => {
        const d = data as { config: TreeConfig; activations: Activations } | null
        if (d?.config && (d.config).nodes?.length > 0) setConfig(d.config)
        if (d?.activations) {
          setActivations(d.activations)
        } else {
          const init: Activations = {}
          defaultConfig.nodes.forEach(n => { if (n.preset==='done'||n.preset==='progress') init[n.id]=true })
          setActivations(init)
        }
        setLoaded(true)
      })
  }, [treeType])

  // ── Save ────────────────────────────────────────────────────────────────
  const scheduleSave = useCallback((cfg: TreeConfig, acts: Activations) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(async () => {
      await supabase.from('skilltree_configs').upsert({ tree_type: treeType, config: cfg, activations: acts, updated_at: new Date().toISOString() })
      setSaving(false)
    }, 900)
  }, [treeType])

  const updateConfig = useCallback((next: TreeConfig) => { setConfig(next); scheduleSave(next, activations) }, [activations, scheduleSave])
  const toggleActivation = useCallback((id: string) => {
    setActivations(prev => { const next={...prev,[id]:!prev[id]}; scheduleSave(config,next); return next })
  }, [config, scheduleSave])

  // ── Drag (X + Y) ────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const { nodeId, startMX, startMY, startNX, startNY } = dragRef.current
      setConfig(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.id === nodeId ? {
          ...n,
          x_offset: Math.round(Math.max(-220, Math.min(220, startNX + e.clientX - startMX))),
          y:        Math.round(Math.max(0,    Math.min(780, startNY + e.clientY - startMY))),
        } : n)
      }))
    }
    const onUp = () => {
      if (dragRef.current) { dragRef.current = null; setConfig(p => { scheduleSave(p, activations); return p }) }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [activations, scheduleSave])

  // ── Helpers ─────────────────────────────────────────────────────────────
  const getPath = (id: string) => config.paths.find(p => p.id === id)
  const getNode = (id: string) => config.nodes.find(n => n.id === id)
  const getEdge = (id: string) => config.edges.find(e => e.id === id)
  const nodeX = (node: NodeDef) => (getPath(node.pathId)?.x ?? 0) + (node.x_offset ?? 0)
  const nodeY = (node: NodeDef) => node.y + PAD

  // ── Click handlers ──────────────────────────────────────────────────────
  const handleNodeClick = (nodeId: string) => {
    if (linkFrom === '__pending__') { setLinkFrom(nodeId); return }
    if (linkFrom !== null) {
      if (linkFrom !== nodeId) {
        const fn = getNode(linkFrom), tn = getNode(nodeId)
        if (fn && tn) {
          const newEdge: EdgeDef = { id: genId(), from: linkFrom, to: nodeId, cross: fn.pathId !== tn.pathId, label: '', label_en: '', label_es: '' }
          updateConfig({ ...config, edges: [...config.edges, newEdge] })
        }
      }
      setLinkFrom(null); return
    }
    if (editMode) {
      const node = getNode(nodeId)!
      setSelection({ type: 'node', id: nodeId })
      setNodeForm({ ...node })
      setFormLang('ko')
    } else {
      toggleActivation(nodeId)
    }
  }

  const handleEdgeClick = (edgeId: string) => {
    if (!editMode) return
    const edge = getEdge(edgeId)!
    setSelection({ type: 'edge', id: edgeId })
    setEdgeForm({ ...edge })
  }

  // ── Node/Edge ops ────────────────────────────────────────────────────────
  const saveNodeForm = () => {
    if (!nodeForm.id) return
    updateConfig({ ...config, nodes: config.nodes.map(n => n.id === nodeForm.id ? { ...n, ...nodeForm } as NodeDef : n) })
  }

  const saveEdgeForm = () => {
    if (!edgeForm.id) return
    updateConfig({ ...config, edges: config.edges.map(e => e.id === edgeForm.id ? { ...e, ...edgeForm } as EdgeDef : e) })
  }

  const deleteNode = (id: string) => {
    updateConfig({ ...config, nodes: config.nodes.filter(n => n.id !== id), edges: config.edges.filter(e => e.from !== id && e.to !== id) })
    setSelection(null)
  }

  const deleteEdge = (id: string) => {
    updateConfig({ ...config, edges: config.edges.filter(e => e.id !== id) })
    setSelection(null)
  }

  const addNode = (pathId: string) => {
    const nn: NodeDef = { id: genId(), pathId, label: '새 마일스톤', sub: '', desc: '', label_en: 'New Milestone', label_es: 'Nuevo Hito', y: 400, x_offset: 0, preset: '' }
    const next = { ...config, nodes: [...config.nodes, nn] }
    updateConfig(next)
    setSelection({ type: 'node', id: nn.id })
    setNodeForm({ ...nn })
  }

  const updatePath = (id: string, field: keyof PathDef, value: string | number) => updateConfig({ ...config, paths: config.paths.map(p => p.id === id ? { ...p, [field]: value } : p) })
  const addPath = () => {
    const colors = ['#e879f9','#fb7185','#34d399','#38bdf8','#a78bfa','#fbbf24']
    const np: PathDef = { id: genId(), label: '새 경로', label_en: 'New Path', label_es: 'Nueva Ruta', color: colors[config.paths.length % colors.length], x: Math.max(...config.paths.map(p => p.x)) + 240 }
    updateConfig({ ...config, paths: [...config.paths, np] })
  }
  const deletePath = (id: string) => {
    updateConfig({ ...config, paths: config.paths.filter(p => p.id !== id), nodes: config.nodes.filter(n => n.pathId !== id), edges: config.edges.filter(e => { const fn=getNode(e.from),tn=getNode(e.to); return fn?.pathId!==id&&tn?.pathId!==id }) })
  }

  if (!loaded) return <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center"><p className="text-gray-500 text-sm">불러오는 중...</p></main>

  const selNode = selection?.type === 'node' ? getNode(selection.id) : null
  const selEdge = selection?.type === 'edge' ? getEdge(selection.id) : null

  return (
    <main className="h-screen flex flex-col overflow-hidden" style={{ background:'radial-gradient(ellipse at 50% 0%,#0d0b1e 0%,#04040a 60%)', color:'white' }}>
      <style>{`
        @keyframes glow-pulse{0%,100%{opacity:1}50%{opacity:.6}}
        @keyframes ring-out{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.2);opacity:0}}
        .ring-pulse::before{content:'';position:absolute;inset:-5px;border-radius:50%;border:2px solid currentColor;animation:ring-out 1.6s ease-out infinite;pointer-events:none}
        .node-circle:hover{transform:scale(1.12)}
      `}</style>

      {/* Header */}
      <div className="px-5 pt-3 pb-2 border-b border-gray-800 shrink-0 flex items-center gap-3 flex-wrap">
        <Link href="/dashboard/career" className="text-gray-500 hover:text-white text-sm shrink-0">← 진로</Link>
        <h1 className="text-sm font-bold" style={{ fontFamily:'Georgia,serif', color:'#d4af37', letterSpacing:'2px' }}>{pageTitle}</h1>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 border border-gray-700 rounded-lg p-0.5">
            {(['ko','en','es'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${lang===l?'bg-gray-600 text-white':'text-gray-500 hover:text-gray-200'}`}>
                {l==='ko'?'한':l.toUpperCase()}
              </button>
            ))}
          </div>
          {saving && <span className="text-[10px] text-gray-600">저장 중...</span>}
          {editMode && <>
            <button onClick={() => setShowPathEditor(p => !p)} className="text-xs px-2.5 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg transition">경로 관리</button>
            {linkFrom ? (
              <button onClick={() => setLinkFrom(null)} className="text-xs px-2.5 py-1 bg-purple-800 text-purple-200 rounded-lg animate-pulse">연결 중... (취소)</button>
            ) : (
              <button onClick={() => { setSelection(null); setLinkFrom('__pending__') }} className="text-xs px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-purple-300 rounded-lg transition">연결 추가</button>
            )}
          </>}
          <button onClick={() => { setEditMode(p => !p); setSelection(null); setLinkFrom(null) }}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${editMode?'bg-blue-600 text-white':'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
            {editMode ? '✓ 편집중' : '✏ 편집'}
          </button>
        </div>
      </div>

      {/* Path editor */}
      {showPathEditor && editMode && (
        <div className="px-4 py-2.5 border-b border-gray-800 bg-gray-900/80 shrink-0 flex flex-wrap gap-2 items-center">
          {config.paths.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 bg-gray-800 rounded-xl px-2.5 py-1.5">
              <input type="color" value={p.color} onChange={e => updatePath(p.id,'color',e.target.value)} className="w-5 h-5 rounded border-0 bg-transparent p-0 cursor-pointer"/>
              <input value={p.label} onChange={e => updatePath(p.id,'label',e.target.value)} className="bg-transparent text-xs outline-none w-20 text-gray-200"/>
              <span className="text-gray-700 text-[10px]">|</span>
              <input value={p.label_en||''} onChange={e => updatePath(p.id,'label_en',e.target.value)} placeholder="EN" className="bg-transparent text-[10px] outline-none w-14 text-gray-500"/>
              <span className="text-gray-700 text-[10px]">|</span>
              <input value={p.label_es||''} onChange={e => updatePath(p.id,'label_es',e.target.value)} placeholder="ES" className="bg-transparent text-[10px] outline-none w-14 text-gray-500"/>
              <span className="text-gray-600 text-[10px]">x:</span>
              <input type="number" value={p.x} step={10} onChange={e => updatePath(p.id,'x',Number(e.target.value))} className="bg-transparent text-[10px] outline-none w-12 text-gray-500"/>
              <button onClick={() => deletePath(p.id)} className="text-gray-700 hover:text-red-400 text-xs transition">✕</button>
            </div>
          ))}
          <button onClick={addPath} className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-xl transition text-gray-300">+ 경로 추가</button>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 overflow-auto relative" onClick={() => { if (linkFrom) setLinkFrom(null) }}>
        <div style={{ position:'relative', width: canvasW, minHeight: CANVAS_H, margin:'0 auto' }}>

          {/* SVG lines */}
          <svg width={canvasW} height={CANVAS_H} style={{ position:'absolute',top:0,left:0,pointerEvents:'none' }}>
            {/* Spine */}
            {config.paths.map(path => {
              const ys = config.nodes.filter(n => n.pathId===path.id).map(n => n.y+PAD)
              if (ys.length<2) return null
              return <line key={path.id} x1={path.x} y1={Math.min(...ys)} x2={path.x} y2={Math.max(...ys)} stroke={path.color+'15'} strokeWidth="2"/>
            })}

            {/* Within-path edges */}
            {config.edges.filter(e => !e.cross).map(e => {
              const fn=getNode(e.from), tn=getNode(e.to)
              if (!fn||!tn) return null
              const fp=getPath(fn.pathId)!
              const both=activations[e.from]&&activations[e.to]
              const fx=nodeX(fn),fy=nodeY(fn),tx=nodeX(tn),ty=nodeY(tn)
              return <line key={e.id} x1={fx} y1={fy} x2={tx} y2={ty} stroke={both?fp.color:'#1e293b'} strokeWidth={both?2.5:1.5} strokeOpacity={both?.9:.35} strokeDasharray={both?undefined:'4,4'}/>
            })}

            {/* Cross edges */}
            {config.edges.filter(e => e.cross).map(e => {
              const fn=getNode(e.from),tn=getNode(e.to)
              if (!fn||!tn) return null
              const fp=getPath(fn.pathId)!,tp=getPath(tn.pathId)!
              const fx=nodeX(fn),fy=nodeY(fn),tx=nodeX(tn),ty=nodeY(tn)
              const mx=(fx+tx)/2
              const both=activations[e.from]&&activations[e.to]
              const col=both?'#a78bfa':'#1e1b2e'
              const lbl=L.edge(e,lang)
              const mx2=(fx+tx)/2, my2=(fy+ty)/2
              return (
                <g key={e.id}>
                  <path d={`M ${fx} ${fy} C ${mx} ${fy}, ${mx} ${ty}, ${tx} ${ty}`} fill="none" stroke={col} strokeWidth={both?2:1} strokeDasharray="6,4" strokeOpacity={both?.9:.5}/>
                  {lbl && <text x={mx2} y={my2-5} fill={both?'#a78bfa':'#374151'} fontSize="9" textAnchor="middle" fontFamily="sans-serif">{lbl}</text>}
                  {editMode && (
                    <circle cx={mx2} cy={my2} r={10} fill="#1e1b2e" fillOpacity=".8" stroke="#4b5563" strokeWidth="1"
                      style={{cursor:'pointer',pointerEvents:'all'}}
                      onClick={(ev) => { ev.stopPropagation(); handleEdgeClick(e.id) }}/>
                  )}
                  {editMode && <text x={mx2} y={my2+3.5} fill="#9ca3af" fontSize="9" textAnchor="middle" fontFamily="sans-serif" style={{pointerEvents:'none'}}>✏</text>}
                </g>
              )
            })}
          </svg>

          {/* Path headers */}
          {config.paths.map(path => (
            <div key={`h-${path.id}`} style={{ position:'absolute',left:path.x,top:14,transform:'translateX(-50%)',color:path.color,fontSize:11,fontWeight:'bold',letterSpacing:2,textAlign:'center',whiteSpace:'nowrap',fontFamily:'sans-serif',textShadow:`0 0 12px ${path.color}70` }}>
              {L.path(path,lang)}
            </div>
          ))}

          {/* Add node buttons */}
          {editMode && config.paths.map(path => {
            const pns=config.nodes.filter(n=>n.pathId===path.id)
            const maxY=pns.length>0?Math.max(...pns.map(n=>n.y+PAD)):400
            return (
              <button key={`add-${path.id}`} onClick={()=>addNode(path.id)}
                style={{ position:'absolute',left:path.x,top:Math.min(maxY+50,CANVAS_H-30),transform:'translate(-50%,0)',background:path.color+'22',border:`1px dashed ${path.color}60`,color:path.color,borderRadius:'50%',width:28,height:28,fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:5,fontFamily:'sans-serif' }}>+</button>
            )
          })}

          {/* Nodes */}
          {config.nodes.map(node => {
            const path=getPath(node.pathId)
            if (!path) return null
            const v=visual(node,activations,path.color)
            const cx=nodeX(node), cy=nodeY(node)
            const isSel=selection?.type==='node'&&selection.id===node.id
            const isLinkTarget=linkFrom!==null&&linkFrom!=='__pending__'&&linkFrom!==node.id
            return (
              <div key={node.id} style={{ position:'absolute',left:cx,top:cy,transform:'translate(-50%,-50%)',zIndex:isSel?30:10,cursor:linkFrom!==null?(isLinkTarget?'cell':'default'):(editMode?'grab':'pointer') }}
                onClick={ev=>{ev.stopPropagation();handleNodeClick(node.id)}}
                onMouseDown={ev=>{
                  if (!editMode||linkFrom!==null) return
                  ev.preventDefault()
                  dragRef.current={nodeId:node.id,startMX:ev.clientX,startMY:ev.clientY,startNX:node.x_offset??0,startNY:node.y}
                }}
                onMouseEnter={()=>!editMode&&setTooltip({node,x:cx,y:cy})}
                onMouseLeave={()=>setTooltip(null)}
              >
                {v.ring&&<div style={{position:'absolute',inset:-5,borderRadius:'50%',border:`2px solid ${v.bd}`,animation:'ring-out 1.6s ease-out infinite',pointerEvents:'none',color:v.bd}}/>}
                <div className="node-circle" style={{ width:48,height:48,borderRadius:'50%',background:v.bg,border:`2px solid ${isSel?'#ffffff':v.bd}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:v.tc,position:'relative',boxShadow:v.glow?`0 0 ${activations[node.id]?18:7}px ${v.glow}${activations[node.id]?'88':'33'}`:isSel?'0 0 0 2px white':undefined,animation:v.anim?'glow-pulse 2s ease-in-out infinite':undefined,transition:'transform .15s',outline:isLinkTarget?`2px solid #a78bfa`:undefined,outlineOffset:2 }}>{v.ic}</div>
                <div style={{ position:'absolute',top:28,left:'50%',transform:'translateX(-50%)',width:112,textAlign:'center',pointerEvents:'none',fontFamily:'sans-serif' }}>
                  <div style={{ color:activations[node.id]?'#e5e7eb':v.tc,fontSize:10,fontWeight:'bold',lineHeight:1.3,whiteSpace:'pre-line' }}>{L.label(node,lang)}</div>
                  {L.sub(node,lang)&&<div style={{ color:activations[node.id]?'#9ca3af':'#374151',fontSize:9,fontStyle:'italic',marginTop:1 }}>{L.sub(node,lang)}</div>}
                </div>
              </div>
            )
          })}

          {/* Link mode banner */}
          {linkFrom && (
            <div style={{ position:'fixed',top:60,left:'50%',transform:'translateX(-50%)',background:'#1e1b2e',border:'1px solid #a78bfa',borderRadius:10,padding:'6px 16px',color:'#a78bfa',fontSize:11,zIndex:50,fontFamily:'sans-serif' }}>
              {linkFrom==='__pending__'
                ? '연결: 첫 번째 노드를 클릭'
                : <>{<span style={{color:getPath(getNode(linkFrom)?.pathId||'')?.color}}>{L.label(getNode(linkFrom)!,lang).replace('\n',' ')}</span>} → 두 번째 노드 클릭</>}
            </div>
          )}

          {/* Tooltip */}
          {tooltip&&!editMode&&(
            <div style={{ position:'fixed',left:tooltip.x>window.innerWidth/2?tooltip.x-245:tooltip.x+36,top:Math.max(8,tooltip.y-40),background:'#09091a',borderRadius:10,padding:'10px 14px',maxWidth:230,border:`1px solid ${(getPath(tooltip.node.pathId)?.color||'#4b5563')+'50'}`,zIndex:999,pointerEvents:'none',fontFamily:'sans-serif',boxShadow:'0 6px 28px #000c' }}>
              <div style={{color:getPath(tooltip.node.pathId)?.color,fontWeight:'bold',fontSize:12,marginBottom:5}}>{L.label(tooltip.node,lang).replace('\n',' ')}</div>
              <div style={{color:'#9ca3af',fontSize:10,lineHeight:1.65}}>{L.desc(tooltip.node,lang)}</div>
              {L.sub(tooltip.node,lang)&&<div style={{color:'#6b7280',fontSize:9,fontStyle:'italic',marginTop:4}}>{L.sub(tooltip.node,lang)}</div>}
            </div>
          )}
        </div>

        {/* Edit sidebar */}
        {editMode && (selNode || selEdge) && (
          <div style={{ position:'fixed',right:12,top:70,width:270,background:'#0f0f1e',border:`1px solid ${selNode?((getPath(selNode.pathId)?.color||'#4b5563')+'40'):'#a78bfa40'}`,borderRadius:16,padding:16,zIndex:50,boxShadow:'0 8px 32px #000c',fontFamily:'sans-serif',maxHeight:'80vh',overflowY:'auto' }}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <span style={{color:selNode?(getPath(selNode.pathId)?.color||'#9ca3af'):'#a78bfa',fontWeight:'bold',fontSize:12}}>
                {selNode?'노드 편집':'연결 편집'}
              </span>
              <button onClick={()=>setSelection(null)} style={{color:'#6b7280',fontSize:14,background:'none',border:'none',cursor:'pointer'}}>✕</button>
            </div>

            {/* Language tabs in edit form */}
            <div style={{display:'flex',gap:3,marginBottom:12,background:'#0a0a14',borderRadius:8,padding:3}}>
              {(['ko','en','es'] as Lang[]).map(l=>(
                <button key={l} onClick={()=>setFormLang(l)} style={{ flex:1,padding:'4px 0',borderRadius:6,fontSize:10,fontWeight:'bold',background:formLang===l?'#1e293b':'transparent',color:formLang===l?'#e5e7eb':'#6b7280',border:'none',cursor:'pointer',transition:'all .15s' }}>
                  {l==='ko'?'한국어':l==='en'?'English':'Español'}
                </button>
              ))}
            </div>

            {selNode && (() => {
              const suffix = formLang==='ko'?'':('_'+formLang)
              const lfield = (f:'label'|'sub'|'desc') => formLang==='ko'?f:`${f}_${formLang}` as keyof NodeDef
              return (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {(['label','sub','desc'] as const).map(field=>{
                    const key=lfield(field)
                    const placeholder={label:{ko:'이름',en:'Name',es:'Nombre'},sub:{ko:'부제',en:'Subtitle',es:'Subtítulo'},desc:{ko:'설명',en:'Description',es:'Descripción'}}[field][formLang]
                    return (
                      <div key={field}>
                        <div style={{color:'#6b7280',fontSize:9,marginBottom:3}}>{placeholder}</div>
                        {field==='desc'
                          ? <textarea value={(nodeForm[key]||'') as string} onChange={e=>setNodeForm(p=>({...p,[key]:e.target.value}))} rows={2} style={{width:'100%',background:'#1a1a2e',border:'1px solid #1e293b',borderRadius:8,padding:'6px 8px',color:'#e5e7eb',fontSize:11,outline:'none',resize:'none',fontFamily:'sans-serif'}}/>
                          : <input value={(nodeForm[key]||'') as string} onChange={e=>setNodeForm(p=>({...p,[key]:e.target.value}))} style={{width:'100%',background:'#1a1a2e',border:'1px solid #1e293b',borderRadius:8,padding:'6px 8px',color:'#e5e7eb',fontSize:11,outline:'none',fontFamily:'sans-serif'}}/>
                        }
                      </div>
                    )
                  })}

                  {formLang==='ko' && <>
                    <div>
                      <div style={{color:'#6b7280',fontSize:9,marginBottom:3,display:'flex',justifyContent:'space-between'}}><span>높이 (낮을수록 고급)</span><span style={{color:'#4b5563'}}>{nodeForm.y}</span></div>
                      <input type="range" min={0} max={780} value={nodeForm.y??400} onChange={e=>setNodeForm(p=>({...p,y:Number(e.target.value)}))} style={{width:'100%',accentColor:getPath(selNode.pathId)?.color}}/>
                    </div>
                    <div>
                      <div style={{color:'#6b7280',fontSize:9,marginBottom:3,display:'flex',justifyContent:'space-between'}}><span>좌우 위치 (분기)</span><span style={{color:'#4b5563'}}>{nodeForm.x_offset??0}</span></div>
                      <input type="range" min={-200} max={200} value={nodeForm.x_offset??0} onChange={e=>setNodeForm(p=>({...p,x_offset:Number(e.target.value)}))} style={{width:'100%',accentColor:getPath(selNode.pathId)?.color}}/>
                    </div>
                    <div>
                      <div style={{color:'#6b7280',fontSize:9,marginBottom:3}}>상태</div>
                      <select value={nodeForm.preset||''} onChange={e=>setNodeForm(p=>({...p,preset:e.target.value}))} style={{width:'100%',background:'#1a1a2e',border:'1px solid #1e293b',borderRadius:8,padding:'6px 8px',color:'#e5e7eb',fontSize:11,outline:'none',fontFamily:'sans-serif'}}>
                        <option value="">미착수</option><option value="pending">예정</option><option value="progress">진행중</option><option value="done">완료</option>
                      </select>
                    </div>
                    <div>
                      <div style={{color:'#6b7280',fontSize:9,marginBottom:3}}>경로</div>
                      <select value={nodeForm.pathId||''} onChange={e=>setNodeForm(p=>({...p,pathId:e.target.value}))} style={{width:'100%',background:'#1a1a2e',border:'1px solid #1e293b',borderRadius:8,padding:'6px 8px',color:'#e5e7eb',fontSize:11,outline:'none',fontFamily:'sans-serif'}}>
                        {config.paths.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </div>
                  </>}

                  <div style={{display:'flex',gap:8,paddingTop:4}}>
                    <button onClick={()=>{saveNodeForm();setSelection(null)}} style={{flex:1,padding:'7px 0',background:'#1e293b',border:'none',borderRadius:8,color:'#e5e7eb',fontSize:10,cursor:'pointer'}}>저장</button>
                    <button onClick={()=>{setLinkFrom(selNode.id);setSelection(null)}} style={{flex:1,padding:'7px 0',background:'#1e1b2e',border:'1px solid #4c1d95',borderRadius:8,color:'#a78bfa',fontSize:10,cursor:'pointer'}}>연결 추가</button>
                    <button onClick={()=>deleteNode(selNode.id)} style={{padding:'7px 10px',background:'#1a0505',border:'1px solid #450a0a',borderRadius:8,color:'#f87171',fontSize:10,cursor:'pointer'}}>삭제</button>
                  </div>
                </div>
              )
            })()}

            {selEdge && (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {(['label','label_en','label_es'] as const).filter((_,i)=>(['ko','en','es'] as Lang[])[i]===formLang||true).map((field,i)=>{
                  const langs:Lang[]=['ko','en','es']
                  if (langs[i]!==formLang) return null
                  const key = field as keyof EdgeDef
                  return (
                    <div key={field}>
                      <div style={{color:'#6b7280',fontSize:9,marginBottom:3}}>연결 이름 ({formLang==='ko'?'한국어':formLang==='en'?'English':'Español'})</div>
                      <input value={(edgeForm[key]||'') as string} onChange={e=>setEdgeForm(p=>({...p,[key]:e.target.value}))} placeholder="ex) 동일 시험 / Same Exam" style={{width:'100%',background:'#1a1a2e',border:'1px solid #1e293b',borderRadius:8,padding:'6px 8px',color:'#e5e7eb',fontSize:11,outline:'none',fontFamily:'sans-serif'}}/>
                    </div>
                  )
                })}
                <div style={{display:'flex',gap:8,paddingTop:4}}>
                  <button onClick={()=>{saveEdgeForm();setSelection(null)}} style={{flex:1,padding:'7px 0',background:'#1e293b',border:'none',borderRadius:8,color:'#e5e7eb',fontSize:10,cursor:'pointer'}}>저장</button>
                  <button onClick={()=>deleteEdge(selEdge.id)} style={{padding:'7px 10px',background:'#1a0505',border:'1px solid #450a0a',borderRadius:8,color:'#f87171',fontSize:10,cursor:'pointer'}}>삭제</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{display:'flex',justifyContent:'center',gap:16,flexWrap:'wrap',padding:'5px 8px',borderTop:'1px solid #0f172a',fontFamily:'sans-serif',fontSize:10,color:'#6b7280',flexShrink:0}}>
        {[{bg:'#451a03',bd:'#f59e0b',ic:'✦',label:{ko:'완료',en:'Done',es:'Completo'}},{bg:'#0c1a2e',bd:'#60a5fa',ic:'◐',label:{ko:'진행중',en:'In Progress',es:'En Progreso'}},{bg:'#111827',bd:'#374151',ic:'○',label:{ko:'예정',en:'Planned',es:'Planeado'}},{bg:'#180c30',bd:'#a78bfa',ic:'★',label:{ko:'클릭 달성',en:'Click to Mark',es:'Clic para Marcar'}},{bg:'#06060e',bd:'#1e293b',ic:'·',label:{ko:'미착수',en:'Not Started',es:'Sin Iniciar'}}].map(item=>(
          <div key={item.ic} style={{display:'flex',alignItems:'center',gap:5}}>
            <div style={{width:14,height:14,borderRadius:'50%',background:item.bg,border:`1.5px solid ${item.bd}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:item.bd}}>{item.ic}</div>
            <span>{item.label[lang]}</span>
          </div>
        ))}
        {editMode&&<span style={{borderLeft:'1px solid #1f2937',paddingLeft:12}}>{lang==='ko'?'드래그(상하좌우)로 위치·분기 조정 · 연결선 ✏ 클릭으로 이름 편집':lang==='en'?'Drag (any dir) to position/branch · Click ✏ on edge to edit label':'Arrastrar para posicionar · Clic ✏ en línea para editar nombre'}</span>}
      </div>
    </main>
  )
}
