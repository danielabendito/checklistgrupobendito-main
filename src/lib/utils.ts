import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Retorna data local no formato YYYY-MM-DD (sem conversão UTC)
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Retorna data/hora local no formato ISO mas sem conversão UTC
export function getLocalDateTimeString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
}

// Retorna data de Brasília no formato YYYY-MM-DD
export function getBrasiliaDateString(date: Date = new Date()): string {
  // Converte para o fuso horário de Brasília (America/Sao_Paulo = UTC-3)
  const brasiliaDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const year = brasiliaDate.getFullYear();
  const month = String(brasiliaDate.getMonth() + 1).padStart(2, '0');
  const day = String(brasiliaDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Retorna data operacional considerando o turno
// Para turno noite: se hora atual for 00:00-05:59, retorna dia anterior
export function getOperationalDateString(turno: string, date: Date = new Date()): string {
  const brasiliaDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hour = brasiliaDate.getHours();
  
  // Para turno noite, se hora for entre 00:00 e 05:59, considera como dia anterior
  if (turno === 'noite' && hour >= 0 && hour < 6) {
    brasiliaDate.setDate(brasiliaDate.getDate() - 1);
  }
  
  const year = brasiliaDate.getFullYear();
  const month = String(brasiliaDate.getMonth() + 1).padStart(2, '0');
  const day = String(brasiliaDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Retorna timestamp no formato ISO ajustado para Brasília (UTC-3)
export function getBrasiliaTimestampISO(date: Date = new Date()): string {
  // Formatar a data no horário de Brasília
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });

  // Retornar no formato ISO: YYYY-MM-DDTHH:mm:ss-03:00
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}-03:00`;
}
