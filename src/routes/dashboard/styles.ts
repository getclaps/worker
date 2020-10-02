import { css } from '../../html';

export const styles = css`
  [hidden] { display: none!important }
  html { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif }
  main, nav > div { max-width: 1024px; margin: auto; }
  body { padding: 3rem 0; overflow-x: hidden; overflow-y: scroll; }
  body.bp3-dark { color: #ccc; background: #293742; }
  table { width: 100% }
  table.bp3-html-table-condensed tr > td:first-child { width: 25px }
  table.bp3-html-table-condensed tr > td:nth-child(2) { width: 60%; max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .opener { color:#bfccd6 }
  @media screen and (min-width: 768px) {
    .row { display:flex; margin:0 -.5rem; }
    .row > * { flex:1; margin:0 .5rem; } }
  div.stats-card {
    max-width: 640px; }
  dl.stats {
    display: grid;
    grid-gap: 0 1rem;
    grid-template-columns: repeat(3, 33%);
    grid-template-rows: auto auto;
    grid-template-areas:
        "a1 b1 c1"
        "a2 b2 c2";
    font-size: larger; }
  dl.stats > dt:after { content: ":" }
  dl.stats > dd { 
    margin-left: 0;
    font-size: 2rem; }
  @media (max-width: 480px) {
    dl.stats {
      grid-template-columns: 100%;
      grid-template-rows: repeat(6, auto);
      grid-template-areas: "a1"
                           "a2"
                           "b1"
                           "b2"
                           "c1"
                           "c2" } 
    dl.stats > dd { text-align: right } }
  dl.stats > dt:nth-of-type(1) { grid-area: a1 }
  dl.stats > dt:nth-of-type(2) { grid-area: b1 }
  dl.stats > dt:nth-of-type(3) { grid-area: c1 }
  dl.stats > dd:nth-of-type(1) { grid-area: a2 }
  dl.stats > dd:nth-of-type(2) { grid-area: b2 }
  dl.stats > dd:nth-of-type(3) { grid-area: c2 }
  input[name=password] { font-family: system-ui-monospace, "Liberation Mono", "Roboto Mono", "Oxygen Mono", "Ubuntu Monospace", "DejaVu Sans Mono", "Fira Code", "Droid Sans Mono", "Menlo", "Consolas", "Monaco", monospace; }
  .flex-center {
    display: flex;
    justify-content: center; }
  .unlock.hidden { display: none }
`;
