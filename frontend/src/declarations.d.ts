// Allow importing CSS files (side-effect imports)
declare module '*.css';
declare module '*.svg' {
  const content: string;
  export default content;
}
declare module '*.png' {
  const content: string;
  export default content;
}
