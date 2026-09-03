/* ==========================================================================
   ui.js — tiện ích giao diện admin: toast, modal, và bộ dựng field khai báo
   (để phần inspector không phải viết HTML lặp lại).
   ========================================================================== */

export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') node.style.cssText = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// ---------------------------------------------------------------- toast

const toastHost = () => document.getElementById('toasts');

export function toast(message, kind = 'info', ms = 3200) {
  const node = h('div', { class: 'adm-toast adm-toast--' + kind }, message);
  toastHost().append(node);
  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 260);
  }, ms);
  return node;
}

// ---------------------------------------------------------------- modal

export function openModal(id) {
  const modal = document.getElementById(id);
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('is-open'));
  return modal;
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove('is-open');
  setTimeout(() => { modal.hidden = true; }, 240);
}

/** Gắn hành vi đóng chung: nút [data-close-modal], click nền, phím Esc. */
export function wireModals() {
  document.querySelectorAll('.adm-modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-close-modal]')) closeModal(modal.id);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = Array.from(document.querySelectorAll('.adm-modal:not([hidden])')).pop();
    if (open) closeModal(open.id);
  });
}

// ---------------------------------------------------------------- fields

/**
 * Dựng một field từ khai báo.
 * spec = { type, label, value, hint, min, max, step, options, unit, onInput }
 */
export function field(spec) {
  const wrap = h('div', { class: 'f' });
  const valueLabel = h('b');

  if (spec.label) {
    const label = h('div', { class: 'f__label' }, spec.label);
    if (spec.type === 'range') {
      valueLabel.textContent = format(spec.value, spec.unit);
      label.append(valueLabel);
    }
    wrap.append(label);
  }

  const emit = (v) => spec.onInput?.(v);
  let control;

  switch (spec.type) {
    case 'textarea':
      control = h('textarea', { class: 'ta', rows: spec.rows || 4, placeholder: spec.placeholder || '' });
      control.value = spec.value ?? '';
      control.addEventListener('input', () => emit(control.value));
      break;

    case 'number':
      control = h('input', { class: 'inp', type: 'number', min: spec.min, max: spec.max, step: spec.step ?? 1 });
      control.value = spec.value ?? '';
      control.addEventListener('input', () => emit(control.value === '' ? null : Number(control.value)));
      break;

    case 'range':
      control = h('input', {
        type: 'range',
        min: spec.min ?? 0, max: spec.max ?? 100, step: spec.step ?? 1
      });
      control.value = spec.value ?? 0;
      control.addEventListener('input', () => {
        valueLabel.textContent = format(control.value, spec.unit);
        emit(Number(control.value));
      });
      break;

    case 'select':
      control = h('select', { class: 'sel' },
        (spec.options || []).map(o => {
          const opt = h('option', { value: o.id }, o.label);
          if (String(o.id) === String(spec.value)) opt.selected = true;
          return opt;
        }));
      control.addEventListener('change', () => emit(control.value));
      break;

    case 'color': {
      const picker = h('input', { type: 'color', value: normalizeHex(spec.value) });
      const text = h('input', { class: 'inp', type: 'text', spellcheck: 'false' });
      text.value = spec.value ?? '';
      picker.addEventListener('input', () => { text.value = picker.value; emit(picker.value); });
      text.addEventListener('input', () => {
        if (/^#[0-9a-f]{6}$/i.test(text.value)) picker.value = text.value;
        emit(text.value);
      });
      control = h('div', { class: 'swatch-row' }, picker, text);
      break;
    }

    case 'checkbox': {
      const box = h('input', { type: 'checkbox' });
      box.checked = !!spec.value;
      box.addEventListener('change', () => emit(box.checked));
      control = h('label', { class: 'chk' }, box, spec.checkboxLabel || spec.label || '');
      if (spec.label) wrap.replaceChildren(); // checkbox tự có nhãn
      break;
    }

    case 'seg': {
      const seg = h('div', { class: 'seg' });
      (spec.options || []).forEach(o => {
        const btn = h('button', { type: 'button', text: o.label });
        if (String(o.id) === String(spec.value)) btn.classList.add('is-on');
        btn.addEventListener('click', () => {
          seg.querySelectorAll('button').forEach(b => b.classList.remove('is-on'));
          btn.classList.add('is-on');
          emit(o.id);
        });
        seg.append(btn);
      });
      control = seg;
      break;
    }

    default:
      control = h('input', { class: 'inp', type: 'text', placeholder: spec.placeholder || '' });
      control.value = spec.value ?? '';
      control.addEventListener('input', () => emit(control.value));
  }

  wrap.append(control);
  if (spec.hint) wrap.append(h('div', { class: 'adm-hint', style: 'margin-top:5px' }, spec.hint));
  return wrap;
}

/** Xếp nhiều field cạnh nhau trên một dòng. */
export const row = (...fields) => h('div', { class: 'f__row' }, ...fields);

const format = (v, unit) => `${v}${unit ?? ''}`;

function normalizeHex(value) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#888888';
}

/** Hộp xác nhận đơn giản (dùng confirm gốc để khỏi dựng thêm modal). */
export const confirmAction = (message) => window.confirm(message);
