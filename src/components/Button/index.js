import React from 'react'
import styles from './index.css'

const Button = (props) => {
  const className = props.className ? `btn ${props.className}` : 'btn';

  return (
    <button onClick={props.onClick} className={className}>
      {props.children}
    </button>
  );
}

export default Button;
