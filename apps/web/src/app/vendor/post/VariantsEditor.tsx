'use client';

import { Button, TextInput } from '../../../components/ui';

export interface VariantDraft {
  label: string;
  unitCount: string;
  originalPrice: string;
  dealPrice: string;
  spotsTotal: string;
}

interface VariantsEditorProps {
  variants: VariantDraft[];
  onChange: (variants: VariantDraft[]) => void;
  unitBased: boolean;
}

const empty: VariantDraft = { label: '', unitCount: '', originalPrice: '', dealPrice: '', spotsTotal: '' };

export function VariantsEditor({ variants, onChange, unitBased }: VariantsEditorProps) {
  const update = (i: number, patch: Partial<VariantDraft>) => {
    onChange(variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  };
  const remove = (i: number) => onChange(variants.filter((_, idx) => idx !== i));
  const add = () => onChange([...variants, { ...empty }]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {variants.map((v, i) => {
        const orig = Number(v.originalPrice);
        const deal = Number(v.dealPrice);
        const pctOff = orig > 0 && deal > 0 && deal < orig ? Math.round(((orig - deal) / orig) * 100) : null;
        return (
          <div
            key={i}
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Option {i + 1}</strong>
              {variants.length > 1 ? (
                <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: 14 }}>
                  Remove
                </button>
              ) : null}
            </div>

            <TextInput
              value={v.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder={unitBased ? 'e.g. 20 units' : 'e.g. Single session'}
            />

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {unitBased ? (
                <LabeledMini label="Units">
                  <TextInput type="number" value={v.unitCount} onChange={(e) => update(i, { unitCount: e.target.value })} placeholder="20" style={{ width: '100%' }} />
                </LabeledMini>
              ) : null}
              <LabeledMini label="Original $">
                <TextInput type="number" value={v.originalPrice} onChange={(e) => update(i, { originalPrice: e.target.value })} placeholder="280" style={{ width: '100%' }} />
              </LabeledMini>
              <LabeledMini label="Deal $">
                <TextInput type="number" value={v.dealPrice} onChange={(e) => update(i, { dealPrice: e.target.value })} placeholder="200" style={{ width: '100%' }} />
              </LabeledMini>
              <LabeledMini label="Spots (optional)">
                <TextInput type="number" value={v.spotsTotal} onChange={(e) => update(i, { spotsTotal: e.target.value })} placeholder="∞" style={{ width: '100%' }} />
              </LabeledMini>
            </div>

            {pctOff !== null ? (
              <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>{pctOff}% off</span>
            ) : null}
          </div>
        );
      })}

      <Button variant="secondary" onClick={add} style={{ alignSelf: 'flex-start', fontSize: 14, padding: '8px 16px' }}>
        + Add another option
      </Button>
    </div>
  );
}

function LabeledMini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ flex: '1 1 120px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</span>
      {children}
    </label>
  );
}
