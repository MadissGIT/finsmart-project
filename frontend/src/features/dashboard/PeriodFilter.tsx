import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { financialToday, formatRange, periodPresets, periodSearch, presetRange, validateRange } from './model/period';
import type { DateRange, PeriodPreset, PeriodSelection } from './model/period';

function CustomPeriod({ range, onApply }: { range: DateRange; onApply: (range: DateRange) => void }) {
  const id = useId();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validateRange({ from, to });
    setError(message);
    if (!message) onApply({ from, to });
  }
  return <form className="custom-period" onSubmit={submit} noValidate aria-label="Свой период">
    <div><label htmlFor={id + '-from'}>С</label><input id={id + '-from'} type="date" min="1900-01-01" max="9998-12-31" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={!!error} aria-describedby={error ? id + '-error' : undefined} required /></div>
    <div><label htmlFor={id + '-to'}>По</label><input id={id + '-to'} type="date" min="1900-01-01" max="9998-12-31" value={to} onChange={(e) => setTo(e.target.value)} aria-invalid={!!error} aria-describedby={error ? id + '-error' : undefined} required /></div>
    <button type="submit" className="button-secondary">Применить</button>
    {error ? <p id={id + '-error'} className="period-error" role="alert">{error}</p> : null}
  </form>;
}

export function PeriodFilter({ selection, onChange }: { selection: PeriodSelection; onChange: (search: URLSearchParams) => void }) {
  const id = useId();
  function select(preset: PeriodPreset) {
    const range = preset === 'custom'
      ? selection.error ? presetRange('current_month', financialToday()) : selection.range
      : presetRange(preset, financialToday());
    onChange(periodSearch(preset, range));
  }
  return <section className="period-filter" aria-label="Фильтр периода">
    <div className="period-select"><label htmlFor={id}>Период</label><select id={id} value={selection.preset} onChange={(e) => select(e.target.value as PeriodPreset)}>{periodPresets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
    {selection.preset === 'custom' ? <CustomPeriod key={selection.range.from + selection.range.to} range={selection.range} onApply={(range) => onChange(periodSearch('custom', range))} /> : null}
    <p className="period-caption">{formatRange(selection.range)}</p>
    {selection.error ? <p role="alert" className="period-error">{selection.error}</p> : null}
  </section>;
}
