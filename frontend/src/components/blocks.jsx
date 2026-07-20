import React, { useState } from "react";

/**
 * Each component here renders ONE validated block. They only trust props
 * that already passed the backend's zod schema, but we still guard against
 * missing optional fields defensively (belt-and-suspenders — see spec #15,
 * "invalid AI-generated UI data does not crash the frontend").
 */

export function TextBlock({ content }) {
  return <p className="block block-text">{typeof content === 'object' ? '' : content}</p>;
}

export function CardBlock({ title, description, image, price, rating, actions = [], onAction }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className="block block-card">
      {typeof image === 'string' && !imgError && (
        <img
          className="card-image"
          src={image}
          alt={typeof title === 'string' ? title : ""}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      )}
      <div className="card-body">
        <h3>{typeof title === 'object' ? '' : title}</h3>
        {description && typeof description !== 'object' && <p className="card-desc">{description}</p>}
        <div className="card-meta">
          {price && typeof price !== 'object' && <span className="card-price">{price}</span>}
          {typeof rating === "number" && <span className="card-rating">⭐ {rating}</span>}
        </div>
        {Array.isArray(actions) && actions.length > 0 && (
          <div className="card-actions">
            {actions.map((a, i) => (
              <button key={i} onClick={() => onAction?.(a.action)}>
                {typeof a.label === 'object' ? '' : a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ButtonBlock({ label, action, variant = "primary", onAction }) {
  return (
    <button className={`block block-button variant-${variant}`} onClick={() => onAction?.(action)}>
      {label}
    </button>
  );
}

export function ChartBlock({ chartType = "bar", title, labels = [], data = [] }) {
  const max = Math.max(1, ...data);
  return (
    <div className="block block-chart">
      {title && <h4>{title}</h4>}
      <div className={`chart chart-${chartType}`}>
        {data.map((value, i) => (
          <div className="chart-row" key={i}>
            <span className="chart-label">{labels[i] ?? ""}</span>
            <div className="chart-bar-track">
              <div className="chart-bar-fill" style={{ width: `${(value / max) * 100}%` }} />
            </div>
            <span className="chart-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableBlock({ title, columns = [], rows = [] }) {
  return (
    <div className="block block-table">
      {title && <h4>{title}</h4>}
      <table>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{String(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FormBlock({ title, fields = [], submitLabel = "Submit", submitAction, onAction }) {
  const [values, setValues] = useState({});
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="block block-form form-submitted">
        <p>✅ Submitted</p>
      </div>
    );
  }

  return (
    <form
      className="block block-form"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        onAction?.(submitAction, values);
      }}
    >
      <h4>{title}</h4>
      {fields.map((f) => (
        <label key={f.name} className="form-field">
          <span>
            {f.label}
            {f.required && " *"}
          </span>
          {f.fieldType === "textarea" ? (
            <textarea
              required={f.required}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            />
          ) : (
            <input
              type={f.fieldType === "phone" ? "tel" : f.fieldType || "text"}
              required={f.required}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            />
          )}
        </label>
      ))}
      <div className="form-actions">
        <button type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}

export function ImageBlock({ url, alt = "" }) {
  const [error, setError] = useState(false);
  if (error) return null;
  return <img className="block block-image" src={url} alt={alt} onError={() => setError(true)} loading="lazy" />;
}

export function ListBlock({ title, items = [] }) {
  return (
    <div className="block block-list">
      {title && <h4>{title}</h4>}
      <ul>
        {Array.isArray(items) && items.map((item, i) => (
          <li key={i}>{typeof item === 'object' && item !== null ? '' : String(item)}</li>
        ))}
      </ul>
    </div>
  );
}
