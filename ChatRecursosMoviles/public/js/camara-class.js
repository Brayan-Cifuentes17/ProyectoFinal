

class Camara {

    constructor( videoNode ) {

        this.videoNode = videoNode;
        console.log('Camara Class init');
    }


    encender() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error("getUserMedia no soportado. Probablemente no estás en HTTPS.");
            if (window.toast) toast('La cámara requiere un entorno seguro (HTTPS)', 'error');
            return;
        }

        navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { width: 300, height: 300 }
        }).then( stream => {
            this.videoNode.srcObject = stream;
            this.stream = stream;
        }).catch( err => {
            console.log("Error solicitando cámara con audio:", err);
            navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { width: 300, height: 300 }
            }).then( stream => {
                this.videoNode.srcObject = stream;
                this.stream = stream;
                if (window.toast) toast('Cámara iniciada sin micrófono', 'warning');
            }).catch( err2 => {
                if (window.toast) toast('No se pudo acceder a la cámara', 'error');
            });
        });
    }


    apagar() {
        this.videoNode.pause();

        if ( this.stream ) {
            this.stream.getTracks().forEach(track => track.stop());
        }
    }


    tomarFoto() {

        // Crear un elemento canvas para renderizr ahí la foto
        let canvas = document.createElement('canvas');


        // Colocar las dimensiones igual al elemento del video
        canvas.setAttribute('width', 300 );
        canvas.setAttribute('height', 300 );

        // obtener el contexto del canvas
        let context = canvas.getContext('2d'); // una simple imagen

        // dibujar, la imagen dentro del canvas
        context.drawImage( this.videoNode, 0, 0, canvas.width, canvas.height );


        this.foto = context.canvas.toDataURL();

        // limpieza
        canvas  = null;
        context = null;

        return this.foto;

    }

    iniciarGrabacion() {
        if (!window.MediaRecorder) {
            throw new Error("El navegador no soporta la grabación de video.");
        }
        
        this.chunks = [];
        this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: 'video/webm' });

        this.mediaRecorder.ondataavailable = e => {
            if (e.data && e.data.size > 0) {
                this.chunks.push(e.data);
            }
        };

        this.mediaRecorder.start();
    }

    detenerGrabacion() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder) {
                return reject("No hay grabación activa.");
            }

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: 'video/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    resolve(reader.result); // Retorna el video en formato de texto Base64
                };
                reader.onerror = reject;
                this.chunks = [];
            };

            this.mediaRecorder.stop();
        });
    }

    iniciarGrabacionAudio() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error("getUserMedia no soportado para audio. ¿Falta HTTPS?");
            if (window.toast) toast('El micrófono requiere un entorno seguro (HTTPS)', 'error');
            return false;
        }

        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                this.audioStream = stream;
                this.audioChunks = [];
                this.audioRecorder = new MediaRecorder(stream);
                this.audioRecorder.ondataavailable = e => this.audioChunks.push(e.data);
                this.audioRecorder.start();
            }).catch(err => {
                console.log("Error solicitando micrófono:", err);
                if (window.toast) toast('Permiso de micrófono denegado', 'error');
            });
        return true;
    }

    detenerGrabacionAudio() {
        return new Promise((resolve, reject) => {
            this.audioRecorder.onstop = () => {
                const blob = new Blob(this.audioChunks, { type: "audio/webm" });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => resolve(reader.result);
            };
            this.audioRecorder.stop();
            this.audioStream.getTracks().forEach(t => t.stop());
        });
    }
}
