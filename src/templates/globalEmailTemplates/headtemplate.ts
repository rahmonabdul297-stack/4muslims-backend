export const emailHeader = () => {
  const header = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
     <header style="background-color: black; color:aqua; width: 100%; border-radius: 5px; border-color: aqua; padding: 2px 5px;">
     <h2 style="padding: 3px;  font-weight: 600; font-size: x-large;">Token</h2>
    </header>`;
  return header;
};

export const emailFooter = () => {
  const Footer = ` <footer
      style="
        background-color: #222;
        color:#fff;
        border-top: 1px;
        border-color: aqua;
        width: 100%;
        height: 50px;
        text-align:center;
        padding-top:2px;
      "
    >
      &copy; 2026 Token.
    </footer>`;
  return Footer;
};
