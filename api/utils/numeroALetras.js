/**
 * Convierte números a letras (Específico para moneda Dólar)
 */
function numeroALetras(num) {
    const aLetras = (n) => {
        const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
        const decenas = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
        const decenasMas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
        const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

        if (n === 0) return 'CERO';
        if (n === 100) return 'CIEN';
        
        let letras = '';
        if (n >= 100) {
            letras += centenas[Math.floor(n / 100)] + ' ';
            n %= 100;
        }
        if (n >= 10 && n <= 19) {
            letras += decenas[n - 10];
        } else {
            if (n >= 20) {
                letras += decenasMas[Math.floor(n / 10)];
                if (n % 10 > 0) letras += ' Y ';
                n %= 10;
            }
            if (n > 0) letras += unidades[n];
        }
        return letras.trim();
    };

    const entero = Math.floor(num);
    const decimales = Math.round((num - entero) * 100);
    
    let resultado = '';
    if (entero >= 1000) {
        const miles = Math.floor(entero / 1000);
        resultado += (miles === 1 ? 'MIL' : aLetras(miles) + ' MIL') + ' ';
    }
    
    const resto = entero % 1000;
    if (resto > 0 || entero === 0) resultado += aLetras(resto);
    if (entero === 1) resultado = 'UN';

    return `${resultado} ${decimales.toString().padStart(2, '0')}/100 USD`;
}

module.exports = { numeroALetras };
