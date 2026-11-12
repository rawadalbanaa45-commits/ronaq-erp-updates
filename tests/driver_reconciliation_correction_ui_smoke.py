from pathlib import Path
root=Path(__file__).parents[1]
ui=(root/'src/renderer/ui/DriversPanel.tsx').read_text(encoding='utf-8')
service=(root/'src/main/services/drivers.ts').read_text(encoding='utf-8')
types=(root/'src/shared/types.d.ts').read_text(encoding='utf-8')
assert 'correctionReason:correctionReason||undefined' in ui
assert 'سبب تعديل مطابقة مغلقة' in ui
assert "existing.status === 'closed' && !input.correctionReason?.trim()" in service
assert 'correctionReason?:string' in types
print('closed driver reconciliation edits require a reason in the UI and service: OK')
