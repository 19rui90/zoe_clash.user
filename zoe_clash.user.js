// ==UserScript==
// @name         ZOE - Clash Screenshot
// @namespace    https://www.managerzone.com/
// @version      1.2.6.7
// @description  Gera imagens do Clash Matcher com upload e guestbook
// @author       ruisimoes
// @license      MIT
// @match        https://www.managerzone.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=managerzone.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @require      https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @connect      greasefork.org
// @connect      statsxente.com
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @connect      ibb.co
// @connect      api.imgbb.com
// @connect      ouo.io
// @connect      ouo.press
// @updateURL   https://raw.githubusercontent.com/19rui90/zoe_clash.user/main/zoe_clash.user.js
// @downloadURL https://raw.githubusercontent.com/19rui90/zoe_clash.user/main/zoe_clash.user.js
// @supportURL  https://greasefork.org/scripts/588299/feedback
// ==/UserScript==

(function () {
    'use strict';

    const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwx8MX_3l_bMga46UQ0SxQeW0fx8kqD2vEKi0H7pAT9-8XBoTHd8j7fJuZUIRy5B7OhyQ/exec';
    const REMOTE_LOG_ACTION = 'clashLog';
    const ZOE_LOG_MAX_ENTRIES = 600;
    const ZOE_LOG_MAX_TEXT = 3000;
    const zoeLogBuffer = [];
    let zoeLogSeq = 0;

    function zoeRedactLogText(value) {
        let text = String(value);
        text = text.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/gi, 'data:image/[base64 omitted]');
        text = text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]');
        text = text.replace(/(password|passwd|pwd|token|cookie|sessionid|session_id|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]');
        text = text.replace(/[A-Za-z0-9+/=]{500,}/g, '[base64 omitted]');
        if (text.length > ZOE_LOG_MAX_TEXT) text = text.slice(0, ZOE_LOG_MAX_TEXT) + '…[truncated]';
        return text;
    }

    function zoeFormatLogArg(arg) {
        try {
            if (arg instanceof Error) return zoeRedactLogText(arg.stack || (arg.name + ': ' + arg.message));
            if (typeof arg === 'string') return zoeRedactLogText(arg);
            if (arg === null || arg === undefined || typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
            if (typeof arg === 'object') {
                try { return zoeRedactLogText(JSON.stringify(arg)); }
                catch(e) { return zoeRedactLogText(String(arg)); }
            }
            return zoeRedactLogText(String(arg));
        } catch(e) {
            return '[unserializable]';
        }
    }

    (function hookZoeConsole() {
        ['log', 'info', 'warn', 'error'].forEach(level => {
            const original = console[level];
            if (typeof original !== 'function') return;
            try {
                console[level] = function() {
                    try {
                        const msg = Array.prototype.slice.call(arguments).map(zoeFormatLogArg).join(' ');
                        zoeLogBuffer.push({ seq: ++zoeLogSeq, ts: new Date().toISOString(), level: level, msg: msg });
                        if (zoeLogBuffer.length > ZOE_LOG_MAX_ENTRIES) zoeLogBuffer.shift();
                    } catch(e) {}
                    return original.apply(console, arguments);
                };
            } catch(e) {}
        });
    })();

    const FED_USERNAMES_KEY = 'zoe_fed_usernames';
    const FED_ID_KEY = 'zoe_our_fed_id';
    const IMGBB_KEY = 'f6f8b2c947f5e122f3e234a39d654110';
    const IMGBB_ALBUM_ID = '2g1mDz';
    const LANGUAGE_KEY = 'zoe_language';

    // --- Localization System ---
    const TRANSLATIONS = {
        pt: {
            language: 'Português',
            flag: 'pt',
            configClash: 'Config Clash',
            clashType: 'Tipo de Clash',
            elo: 'Pontuação ELO',
            best: 'Melhor Combinação',
            offer: 'Sacrificar Equipas',
            teamsOffered: 'Equipas Oferecidas',
            showUsers: 'Mostrar',
            tableWidth: 'Largura da Tabela',
            imgSize: 'Tamanho da Imagem',
            showTeams: 'Mostrar Equipas',
            showElo: 'Mostrar ELO',
            showLmv: 'Mostrar LMV',
            showStats: 'Mostrar Estatísticas',
            guestbookTemplate: 'Template do Guestbook',
            imgExpiration: 'Expiração da Imagem (dias)',
            askBeforePost: 'Perguntar antes de publicar',
            imgScale: 'Escala da Imagem',
            autoChineseSwitch: 'Auto-switch chinês',
            boardType: 'Tipo de Board',
            autoRun: 'AutoRun',
            autoRunBefore: 'Executar AutoRun antes (horas)',
            autoMessage: 'AutoMessage',
            autoMessageBefore: 'Executar AutoMessage antes (horas)',
            autoMessageTemplate: 'Template do AutoMessage',
            chatToManagers: 'Chat para Managers',
            chatTemplate: 'Template do Chat',
            sendDiagnosticLogs: 'Enviar logs de diagnóstico',
            sendDiagnosticLogsTooltip: 'Envia registos técnicos automáticos quando o fluxo gera uma imagem (sem emails nem passwords). Cliques manuais, testes de chat e tentativas de Auto-Mensagem são sempre registados.',
            save: 'Guardar',
            cancel: 'Cancelar',
            soccer: 'Futebol',
            hockey: 'Hoquei',
            federation: 'Federação',
            team: 'Equipa',
            saveSettings: 'Definições guardadas!',
            settingsError: 'Erro ao guardar definições',
            visibleColumns: 'Colunas visíveis',
            small: 'Pequena',
            normal: 'Normal',
            large: 'Grande',
            xlarge: 'Muito grande',
            xxlarge: 'Enorme',
            resolution: 'Resolução',
            quality: 'Qualidade',
            deleteImageAfter: 'Apagar a imagem após',
            after1Week: '1 semana',
            after2Weeks: '2 semanas',
            after3Weeks: '3 semanas',
            after1Month: '1 mês',
            after2Months: '2 meses',
            after3Months: '3 meses',
            after6Months: '6 meses',
            auto: 'Auto?',
            run: 'Executar',
            hoursBeforeNextRound: 'horas antes da próxima jornada',
            autoMessage: 'Auto-Mensagem',
            suggestions: 'Sugestões',
            checkUpdates: 'Verificar atualizações',
            versionHistory: 'Histórico de versões',
            sendMessageTo: 'Enviar para',
            none: 'Nenhuma',
            open: 'Aberto',
            federationMembers: 'Membros da Federação',
            firstTeamMembers: 'Membros da 1ª Equipa',
            users: 'Usuários',
            teams: 'Equipas',
            pointsMatches: 'Pontos/Partidas',
            askBefore: 'Perguntar antes?',
            message: 'Mensagem',
            chat: 'Chat?',
            noImageWarning: '⚠ Nenhuma imagem será publicada (falta *image* ou *image_stats* na mensagem)',
            teamsUsers: 'Equipas / User',
            chatTooltip: 'Ao ativar esta opção, quando a imagem é publicada no painel com sucesso, cada manager da sua federação receberá uma mensagem privada com os dados do seu próprio confronto (1 mensagem por manager por jornada).',
            chineseTooltip: 'Mostra "Usuários" se o rival for chinês',
            selectedCount: 'selecionadas',
            sendSuggestions: 'Envia-me Sugestões',
            imageQuality: 'Qualidade da imagem gerada',
            templateModalTitle: 'Editar Mensagem',
            templateModalSave: 'Guardar',
            templateModalCancel: 'Cancelar',
            availableVariables: 'Variáveis disponíveis:',
            variableRound: '*round* - Número da jornada',
            variableSeason: '*season* - Temporada',
            variableDivision: '*division* - Divisão',
            variableRival: '*rival* - Nome do rival',
            variableImage: '*image* - Imagem do confronto',
            variableImageStats: '*image_stats* - Imagem com estatísticas',
            variableElo: '*elo* - Bloco ELO/LMV',
            variableMatches: '*matches* - Lista de confrontos',
            varDescRound: 'Jornada',
            varDescSeason: 'Época',
            varDescDivision: 'Divisão',
            varDescRival: 'Federação Adversária',
            varDescImage: 'Tabela',
            varDescImageStats: 'Tabela com Estatísticas',
			varDescUrl: 'Endereço da imagem',
            chatModalTitle: 'Chat',
            chatModalTest: 'Pré-Vizualização',
            chatModalVariables: 'Variáveis:',
            chatModalUser: '*user* - Nome do usuário',
            chatModalTeam: '*team* - Nome da equipa',
            chatModalElo: '*elo* - ELO',
            chatModalLmv: '*LMV* - LMV',
            chatModalUserRival: '*user_rival* - Nome do usuário rival',
            chatModalTeamRival: '*team_rival* - Nome da equipa rival',
            chatModalEloRival: '*elo_rival* - ELO rival',
            chatModalLmvRival: '*LMV_rival* - LMV rival',
            chatModalEloDif: '*elo_dif* - Diferença de ELO',
            chatModalLmvDif: '*LMV_dif* - Diferença de LMV',
            chatModalExample: 'Exemplo',
            chatModalOutput: 'Resultado',
            chatModalLimit: 'Só é possível enviar 1 mensagem por jornada a cada manager.',
            chatModalOurFed: '(nossa federação)',
            chatModalRivalFed: '(federação rival)',
            chatModalDifBetween: '(diferença entre as duas equipas)',
            chatModalRoundEquals: '*round* = Jornada',
            chatModalSeasonEquals: '*season* = Época',
            chatModalDivisionEquals: '*division* = Divisão',
            chatModalUserHere: '*user*, aqui tens o teu confronto!',
            chatModalUserTeam: '*user* (*team*) - ELO (*elo*) - LMV (*LMV*)',
            chatModalUserRivalTeam: '*user_rival* (*team_rival*) - ELO (*elo_rival*) - LMV (*LMV_rival*)',
            chatModalSummary: 'Resumo: ELO (*elo_dif*) - LMV (*LMV_dif*)',
            chatModalExampleOutput: 'ruisimoes, aqui tens o teu confronto!',
            chatModalExampleOutput2: 'ruisimoes (GD Almargense) - ELO (1500) - LMV (11 601 781)',
            chatModalExampleOutput3: 'fhuryon (Fhury FC) - ELO (1700) - LMV (12 078 083)',
            chatModalExampleOutput4: 'Resumo: ELO (-200) - LMV (-476 302)',
            askBeforeTooltip: 'Pedir confirmação antes de publicar a imagem no painel',
            autorunInactive: 'AutoRun: INACTIVA',
            autorunActive: 'AutoRun: ATIVA',
            autorunStatusTitle: 'Estado do AutoRun',
            automessagePrefix: 'Auto-Mensagem: ',
            automessageUntil: ' até envio',
            automessageStatusTitle: 'Clicar para ver os managers em falta',
            newVersionAvailable: 'Nova versão disponível',
            clickToUpdate: 'Clique para atualizar',
            autorunUntilExecution: ' até execução',
            automessageInactive: 'Auto-Mensagem: INACTIVA',
            automessageSending: 'Auto-Mensagem: a enviar',
            automessageOf: ' a ',
            automessageSent: 'Auto-Mensagem: ',
            automessageSentCount: ' enviadas',
            automessageFailed: ' (',
            automessageFailedCount: ' falharam)',
            automessageDeferred: 'Auto-Mensagem: adiada 10 min',
            currentVersion: 'Versão atual',
            remoteVersionLabel: 'Nova versão',
            generatingImage: 'A gerar imagem...',
            noGamesFound: 'Nenhum jogo encontrado entre as federações nesta época.',
            imageGenerated: 'Imagem gerada!',
            confirmSendToBoard: 'Quer enviar a imagem para o Painel de mensagens da federação?',
            yes: 'Sim',
            no: 'Não',
            scriptRunningWarning: '⏳ ZOE - Clash Screenshot em execução — não saia da página',
            checkingPermissions: 'A verificar permissões...',
            postingToGuestbook: 'A postar no guestbook...',
            postingToBoard: 'A postar no painel',
            detectingFederations: 'A detetar federações...',
            autoDetectingFederations: '[AUTO] A detetar federações...',
            extractingFederationData: 'A extrair dados da federação...',
            detectingRival: 'A detetar rival na página do Clash...',
            fetchingClashData: 'A buscar dados do Clash...',
            errorNoUsername: 'Erro: Não foi possível detetar o teu username. Inicia sessão no ManagerZone.',
            errorNoFederation: 'Erro: Nenhuma federação encontrada. Contactar o user @ruisimoes',
            boardOpen: 'Aberto',
            boardFederation: 'Membros da Federação',
            boardTeam: 'Membros da 1ª Equipa',
            imagePostedGuestbook: 'Imagem postada no guestbook!',
            imagePostedBoard: 'Imagem postada no painel',
            chatConfirmTitle: 'Confirmar envio de mensagens',
            chatConfirmMessage: 'Vão ser enviadas mensagens privadas a',
            chatConfirmManagers: 'manager(s):',
            chatConfirmInstruction: 'Desmarca os managers que NÃO devem receber a mensagem.',
            chatConfirmPermission: 'Permites que o ZOE envie estas mensagens agora?',
            chatConfirmCancel: 'Cancelar',
            chatConfirmDefer: 'Adiar 10 minutos',
            chatConfirmSend: 'Enviar',
            chatSending: 'A enviar mensagens...',
            chatSendingManager: 'Enviando para',
            chatSendingComplete: 'Envio completo!',
            chatSendingProgress: 'A enviar mensagem',
            chatSendingOf: ' de ',
            chatSendingTo: ' a ',
            chatSelectManager: 'Seleciona pelo menos um manager para enviar a mensagem.',
            sendResultTitle: 'Resultado do envio',
            sendSuccessMessage: 'Mensagem enviada com sucesso para',
            sendSuccessManagers: 'manager(s):',
            cancelConfirmMessage: 'Ao cancelar, esta janela deixará de aparecer nesta jornada. Tem a certeza?',
            cancelConfirmNo: 'Não',
            cancelConfirmYes: 'Sim',
            managersNotPlayed: 'Managers que ainda não jogaram',
            missingToPlay: 'Faltam jogar',
            missingOf: ' de ',
            missingManagers: 'manager(s):',
            loadingList: 'A carregar lista...',
            deselectManagers: 'Desmarca os managers que NÃO devem receber a mensagem.',
            sendMessageBtn: 'Enviar mensagem',
            mainMember: '(Membro Principal)',
            errorRoundAlreadyGenerated: 'Erro: A tabela da Jornada',
            errorRoundAlreadyGeneratedSuffix: 'já foi gerada'
        },
        en: {
            language: 'English',
            flag: 'gb',
            configClash: 'Config Clash',
            clashType: 'Clash Type',
            elo: 'ELO Score',
            best: 'Best Match',
            offer: 'Sacrifice Teams',
            teamsOffered: 'Teams Offered',
            showUsers: 'Show',
            tableWidth: 'Table Width',
            imgSize: 'Image Size',
            showTeams: 'Show Teams',
            showElo: 'Show ELO',
            showLmv: 'Show LMV',
            showStats: 'Show Statistics',
            guestbookTemplate: 'Guestbook Template',
            imgExpiration: 'Image Expiration (days)',
            askBeforePost: 'Ask before posting',
            imgScale: 'Image Scale',
            autoChineseSwitch: 'Auto-switch Chinese',
            boardType: 'Board Type',
            autoRun: 'AutoRun',
            autoRunBefore: 'Run AutoRun before (hours)',
            autoMessage: 'AutoMessage',
            autoMessageBefore: 'Run AutoMessage before (hours)',
            autoMessageTemplate: 'AutoMessage Template',
            chatToManagers: 'Chat to Managers',
            chatTemplate: 'Chat Template',
            sendDiagnosticLogs: 'Send diagnostic logs',
            sendDiagnosticLogsTooltip: 'Sends automatic technical reports when the flow generates an image (no emails or passwords). Manual clicks, chat tests and Auto-Message attempts are always logged.',
            language: 'Language',
            save: 'Save',
            cancel: 'Cancel',
            soccer: 'Soccer',
            hockey: 'Hockey',
            federation: 'Federation',
            team: 'Team',
            saveSettings: 'Settings saved!',
            settingsError: 'Error saving settings',
            visibleColumns: 'Visible Columns',
            small: 'Small',
            normal: 'Normal',
            large: 'Large',
            xlarge: 'Very large',
            xxlarge: 'Huge',
            resolution: 'Resolution',
            quality: 'Quality',
            deleteImageAfter: 'Delete image after',
            after1Week: '1 week',
            after2Weeks: '2 weeks',
            after3Weeks: '3 weeks',
            after1Month: '1 month',
            after2Months: '2 months',
            after3Months: '3 months',
            after6Months: '6 months',
            auto: 'Auto?',
            run: 'Run',
            hoursBeforeNextRound: 'hours before next round',
            autoMessage: 'Auto-Message',
            suggestions: 'Suggestions',
            checkUpdates: 'Check for updates',
            versionHistory: 'Version history',
            sendMessageTo: 'Send to',
            none: 'None',
            open: 'Open',
            federationMembers: 'Federation Members',
            firstTeamMembers: '1st Team Members',
            users: 'Users',
            teams: 'Teams',
            pointsMatches: 'Points/Matches',
            askBefore: 'Ask before?',
            message: 'Message',
            chat: 'Chat?',
            noImageWarning: '⚠ No image will be published (missing *image* or *image_stats* in message)',
            teamsUsers: 'Teams / Users',
            chatTooltip: 'When this option is enabled, after the image is successfully published to the board, each manager in your federation will receive a private message with their own matchup data (1 message per manager per round).',
            chineseTooltip: 'Shows "Users" if rival is Chinese',
            selectedCount: 'selected',
            sendSuggestions: 'Send me suggestions',
            imageQuality: 'Generated image quality',
            templateModalTitle: 'Edit Message',
            templateModalSave: 'Save',
            templateModalCancel: 'Cancel',
            availableVariables: 'Available variables:',
            variableRound: '*round* - Round number',
            variableSeason: '*season* - Season',
            variableDivision: '*division* - Division',
            variableRival: '*rival* - Rival name',
            variableImage: '*image* - Matchup image',
            variableImageStats: '*image_stats* - Image with statistics',
            variableElo: '*elo* - ELO/LMV block',
            variableMatches: '*matches* - Matchup list',
            varDescRound: 'Round',
            varDescSeason: 'Season',
            varDescDivision: 'Division',
            varDescRival: 'Rival Federation',
            varDescImage: 'Table',
            varDescImageStats: 'Table with Statistics',
			varDescUrl: 'Image URL',
            chatModalTitle: 'Chat',
            chatModalTest: 'Test',
            chatModalVariables: 'Variables:',
            chatModalUser: '*user* - User name',
            chatModalTeam: '*team* - Team name',
            chatModalElo: '*elo* - ELO',
            chatModalLmv: '*LMV* - LMV',
            chatModalUserRival: '*user_rival* - Rival user name',
            chatModalTeamRival: '*team_rival* - Rival team name',
            chatModalEloRival: '*elo_rival* - Rival ELO',
            chatModalLmvRival: '*LMV_rival* - Rival LMV',
            chatModalEloDif: '*elo_dif* - ELO difference',
            chatModalLmvDif: '*LMV_dif* - LMV difference',
            chatModalExample: 'Example:',
            chatModalOutput: 'Output (for manager ruisimoes):',
            chatModalLimit: 'Only 1 message per round can be sent to each manager.',
            chatModalOurFed: '(our federation)',
            chatModalRivalFed: '(rival federation)',
            chatModalDifBetween: '(difference between the two teams)',
            chatModalRoundEquals: '*round* = Round',
            chatModalSeasonEquals: '*season* = Season',
            chatModalDivisionEquals: '*division* = Division',
            chatModalUserHere: '*user*, here is your matchup!',
            chatModalUserTeam: '*user* (*team*) - ELO (*elo*) - LMV (*LMV*)',
            chatModalUserRivalTeam: '*user_rival* (*team_rival*) - ELO (*elo_rival*) - LMV (*LMV_rival*)',
            chatModalSummary: 'Summary: ELO (*elo_dif*) - LMV (*LMV_dif*)',
            chatModalExampleOutput: 'ruisimoes, here is your matchup!',
            chatModalExampleOutput2: 'ruisimoes (GD Almargense) - ELO (1500) - LMV (11 601 781)',
            chatModalExampleOutput3: 'fhuryon (Fhury FC) - ELO (1700) - LMV (12 078 083)',
            chatModalExampleOutput4: 'Summary: ELO (-200) - LMV (-476 302)',
            askBeforeTooltip: 'Ask for confirmation before publishing the image to the board',
            autorunInactive: 'AutoRun: INACTIVE',
            autorunActive: 'AutoRun: ACTIVE',
            autorunStatusTitle: 'AutoRun Status',
            automessagePrefix: 'Auto-Message: ',
            automessageUntil: ' until send',
            automessageStatusTitle: 'Click to see missing managers',
            newVersionAvailable: 'New version available',
            clickToUpdate: 'Click to update',
            autorunUntilExecution: ' until execution',
            automessageInactive: 'Auto-Message: INACTIVE',
            automessageSending: 'Auto-Message: sending to',
            automessageOf: ' to ',
            automessageSent: 'Auto-Message: ',
            automessageSentCount: ' sent',
            automessageFailed: ' (',
            automessageFailedCount: ' failed)',
            automessageDeferred: 'Auto-Message: deferred 10 min',
            currentVersion: 'Current version',
            remoteVersionLabel: 'New version',
            generatingImage: 'Generating image...',
            noGamesFound: 'No games found between federations this season.',
            imageGenerated: 'Image generated!',
            confirmSendToBoard: 'Do you want to send the image to the federation message board?',
            yes: 'Yes',
            no: 'No',
            scriptRunningWarning: '⏳ ZOE - Clash Screenshot running — do not leave the page',
            checkingPermissions: 'Checking permissions...',
            postingToGuestbook: 'Posting to guestbook...',
            postingToBoard: 'Posting to board',
            detectingFederations: 'Detecting federations...',
            autoDetectingFederations: '[AUTO] Detecting federations...',
            extractingFederationData: 'Extracting federation data...',
            detectingRival: 'Detecting rival on Clash page...',
            fetchingClashData: 'Fetching Clash data...',
            errorNoUsername: 'Error: Could not detect your username. Log in to ManagerZone.',
            errorNoFederation: 'Error: No federation found. Contact user @ruisimoes',
            boardOpen: 'Open',
            boardFederation: 'Federation Members',
            boardTeam: 'First Team Members',
            imagePostedGuestbook: 'Image posted to guestbook!',
            imagePostedBoard: 'Image posted to board',
            chatConfirmTitle: 'Confirm message sending',
            chatConfirmMessage: 'Private messages will be sent to',
            chatConfirmManagers: 'manager(s):',
            chatConfirmInstruction: 'Uncheck managers who should NOT receive the message.',
            chatConfirmPermission: 'Do you allow ZOE to send these messages now?',
            chatConfirmCancel: 'Cancel',
            chatConfirmDefer: 'Defer 10 minutes',
            chatConfirmSend: 'Send',
            chatSending: 'Sending messages...',
            chatSendingManager: 'Sending to',
            chatSendingComplete: 'Sending complete!',
            chatSendingProgress: 'Sending message',
            chatSendingOf: ' of ',
            chatSendingTo: ' to ',
            chatSelectManager: 'Select at least one manager to send the message.',
            sendResultTitle: 'Send Result',
            sendSuccessMessage: 'Message sent successfully to',
            sendSuccessManagers: 'manager(s):',
            cancelConfirmMessage: 'By canceling, this window will not appear again this round. Are you sure?',
            cancelConfirmNo: 'No',
            cancelConfirmYes: 'Yes',
            managersNotPlayed: 'Managers who have not played yet',
            missingToPlay: 'Missing',
            missingOf: ' of ',
            missingManagers: 'manager(s):',
            loadingList: 'Loading list...',
            deselectManagers: 'Uncheck managers who should NOT receive the message.',
            sendMessageBtn: 'Send message',
            mainMember: '(Key Member)',
            errorRoundAlreadyGenerated: 'Error: Round table',
            errorRoundAlreadyGeneratedSuffix: 'already generated'
        },
        es: {
            language: 'Español',
            flag: 'es',
            configClash: 'Config Clash',
            clashType: 'Tipo de Clash',
            elo: 'Puntuación ELO',
            best: 'Mejor Combinación',
            offer: 'Sacrificar Equipos',
            teamsOffered: 'Equipos Ofrecidos',
            showUsers: 'Mostrar',
            tableWidth: 'Ancho de Tabla',
            imgSize: 'Tamaño de Imagen',
            showTeams: 'Mostrar Equipos',
            showElo: 'Mostrar ELO',
            showLmv: 'Mostrar LMV',
            showStats: 'Mostrar Estadísticas',
            guestbookTemplate: 'Template de Guestbook',
            imgExpiration: 'Expiración de Imagen (días)',
            askBeforePost: 'Preguntar antes de publicar',
            imgScale: 'Escala de Imagen',
            autoChineseSwitch: 'Auto-switch chino',
            boardType: 'Tipo de Board',
            autoRun: 'AutoRun',
            autoRunBefore: 'Ejecutar AutoRun antes (horas)',
            autoMessage: 'AutoMessage',
            autoMessageBefore: 'Ejecutar AutoMessage antes (horas)',
            autoMessageTemplate: 'Template de AutoMessage',
            chatToManagers: 'Chat a Managers',
            chatTemplate: 'Template de Chat',
            sendDiagnosticLogs: 'Enviar registros de diagnóstico',
            sendDiagnosticLogsTooltip: 'Envía registros técnicos automáticos cuando el flujo genera una imagen (sin correos ni contraseñas). Los clics manuales, las pruebas de chat y los intentos de Auto-Mensaje siempre se registran.',
            language: 'Idioma',
            save: 'Guardar',
            cancel: 'Cancelar',
            soccer: 'Fútbol',
            hockey: 'Hockey',
            federation: 'Federación',
            team: 'Equipo',
            saveSettings: '¡Configuración guardada!',
            settingsError: 'Error al guardar configuración',
            visibleColumns: 'Columnas visibles',
            small: 'Pequeña',
            normal: 'Normal',
            large: 'Grande',
            xlarge: 'Muy grande',
            xxlarge: 'Enorme',
            resolution: 'Resolución',
            quality: 'Calidad',
            deleteImageAfter: 'Borrar imagen después de',
            after1Week: '1 semana',
            after2Weeks: '2 semanas',
            after3Weeks: '3 semanas',
            after1Month: '1 mes',
            after2Months: '2 meses',
            after3Months: '3 meses',
            after6Months: '6 meses',
            auto: 'Auto?',
            run: 'Ejecutar',
            hoursBeforeNextRound: 'horas antes de la próxima jornada',
            autoMessage: 'Auto-Mensaje',
            suggestions: 'Sugerencias',
            checkUpdates: 'Verificar actualizaciones',
            versionHistory: 'Historial de versiones',
            sendMessageTo: 'Enviar a:',
            none: 'Ninguna',
            open: 'Abierto',
            federationMembers: 'Miembros de la Federación',
            firstTeamMembers: 'Miembros del 1er Equipo',
            users: 'Usuarios',
            teams: 'Equipos',
            pointsMatches: 'Puntos/Partidos',
            askBefore: 'Preguntar antes?',
            message: 'Mensaje',
            chat: 'Chat?',
            noImageWarning: '⚠ No se publicará ninguna imagen (falta *image* o *image_stats* en el mensaje)',
            teamsUsers: 'Equipos / Usuarios',
            chatTooltip: 'Al activar esta opción, cuando la imagen se publique con éxito en el panel, cada manager de su federación recibirá un mensaje privado con los datos de su propio enfrentamiento (1 mensaje por manager por jornada).',
            chineseTooltip: 'Muestra "Usuarios" si el rival es chino',
            selectedCount: 'seleccionadas',
            sendSuggestions: 'Envíame sugerencias',
            imageQuality: 'Calidad de la imagen generada',
            templateModalTitle: 'Editar Mensaje',
            templateModalSave: 'Guardar',
            templateModalCancel: 'Cancelar',
            availableVariables: 'Variables disponibles:',
            variableRound: '*round* - Número de jornada',
            variableSeason: '*season* - Temporada',
            variableDivision: '*division* - División',
            variableRival: '*rival* - Nombre del rival',
            variableImage: '*image* - Imagen del enfrentamiento',
            variableImageStats: '*image_stats* - Imagen con estadísticas',
            variableElo: '*elo* - Bloque ELO/LMV',
            variableMatches: '*matches* - Lista de enfrentamientos',
            varDescRound: 'Jornada',
            varDescSeason: 'Temporada',
            varDescDivision: 'División',
            varDescRival: 'Federación Rival',
            varDescImage: 'Tabla',
            varDescImageStats: 'Tabla con Estadísticas',
			varDescUrl: 'Dirección de la imagen',
            chatModalTitle: 'Chat',
            chatModalTest: 'Prueba',
            chatModalVariables: 'Variables:',
            chatModalUser: '*user* - Nombre de usuario',
            chatModalTeam: '*team* - Nombre de equipo',
            chatModalElo: '*elo* - ELO',
            chatModalLmv: '*LMV* - LMV',
            chatModalUserRival: '*user_rival* - Nombre de usuario rival',
            chatModalTeamRival: '*team_rival* - Nombre de equipo rival',
            chatModalEloRival: '*elo_rival* - ELO rival',
            chatModalLmvRival: '*LMV_rival* - LMV rival',
            chatModalEloDif: '*elo_dif* - Diferencia de ELO',
            chatModalLmvDif: '*LMV_dif* - Diferencia de LMV',
            chatModalExample: 'Ejemplo:',
            chatModalOutput: 'Output (para el manager ruisimoes):',
            chatModalLimit: 'Solo se puede enviar 1 mensaje por jornada a cada manager.',
            chatModalOurFed: '(nuestra federación)',
            chatModalRivalFed: '(federación rival)',
            chatModalDifBetween: '(diferencia entre los dos equipos)',
            chatModalRoundEquals: '*round* = Jornada',
            chatModalSeasonEquals: '*season* = Temporada',
            chatModalDivisionEquals: '*division* = División',
            chatModalUserHere: '*user*, aquí tienes tu enfrentamiento!',
            chatModalUserTeam: '*user* (*team*) - ELO (*elo*) - LMV (*LMV*)',
            chatModalUserRivalTeam: '*user_rival* (*team_rival*) - ELO (*elo_rival*) - LMV (*LMV_rival*)',
            chatModalSummary: 'Resumen: ELO (*elo_dif*) - LMV (*LMV_dif*)',
            chatModalExampleOutput: 'ruisimoes, aquí tienes tu enfrentamiento!',
            chatModalExampleOutput2: 'ruisimoes (GD Almargense) - ELO (1500) - LMV (11 601 781)',
            chatModalExampleOutput3: 'fhuryon (Fhury FC) - ELO (1700) - LMV (12 078 083)',
            chatModalExampleOutput4: 'Resumen: ELO (-200) - LMV (-476 302)',
            askBeforeTooltip: 'Pedir confirmación antes de publicar la imagen en el panel',
            autorunInactive: 'AutoRun: INACTIVO',
            autorunActive: 'AutoRun: ACTIVO',
            autorunStatusTitle: 'Estado del AutoRun',
            automessagePrefix: 'Auto-Mensaje: ',
            automessageUntil: ' hasta envío',
            automessageStatusTitle: 'Click para ver los managers faltantes',
            newVersionAvailable: 'Nueva versión disponible',
            clickToUpdate: 'Click para actualizar',
            autorunUntilExecution: ' hasta ejecución',
            automessageInactive: 'Auto-Mensaje: INACTIVO',
            automessageSending: 'Auto-Mensaje: enviando a',
            automessageOf: ' a ',
            automessageSent: 'Auto-Mensaje: ',
            automessageSentCount: ' enviadas',
            automessageFailed: ' (',
            automessageFailedCount: ' fallaron)',
            automessageDeferred: 'Auto-Mensaje: aplazada 10 min',
            currentVersion: 'Versión actual',
            remoteVersionLabel: 'Nueva versión',
            generatingImage: 'Generando imagen...',
            noGamesFound: 'No se encontraron juegos entre las federaciones esta temporada.',
            imageGenerated: '¡Imagen generada!',
            confirmSendToBoard: '¿Quieres enviar la imagen al panel de mensajes de la federación?',
            yes: 'Sí',
            no: 'No',
            scriptRunningWarning: '⏳ ZOE - Clash Screenshot ejecutándose — no salgas de la página',
            checkingPermissions: 'Verificando permisos...',
            postingToGuestbook: 'Publicando en guestbook...',
            postingToBoard: 'Publicando en panel',
            detectingFederations: 'Detectando federaciones...',
            autoDetectingFederations: '[AUTO] Detectando federaciones...',
            extractingFederationData: 'Extrayendo datos de federación...',
            detectingRival: 'Detectando rival en página Clash...',
            fetchingClashData: 'Obteniendo datos Clash...',
            errorNoUsername: 'Error: No se pudo detectar tu username. Inicia sesión en ManagerZone.',
            errorNoFederation: 'Error: No se encontró federación. Contactar al usuario @ruisimoes',
            boardOpen: 'Abierto',
            boardFederation: 'Miembros de Federación',
            boardTeam: 'Miembros del 1er Equipo',
            imagePostedGuestbook: '¡Imagen publicada en guestbook!',
            imagePostedBoard: '¡Imagen publicada en panel',
            chatConfirmTitle: 'Confirmar envio de mensagens',
            chatConfirmMessage: 'Vão ser enviadas mensagens privadas a',
            chatConfirmManagers: 'manager(s):',
            chatConfirmInstruction: 'Desmarca os managers que NÃO devem receber a mensagem.',
            chatConfirmPermission: 'Permites que o ZOE envie estas mensagens agora?',
            chatConfirmCancel: 'Cancelar',
            chatConfirmDefer: 'Adiar 10 minutos',
            chatConfirmSend: 'Enviar',
            chatSending: 'Enviando mensajes...',
            chatSendingManager: 'Enviando a',
            chatSendingComplete: '¡Envío completo!',
            chatSendingProgress: 'Enviando mensaje',
            chatSendingOf: ' de ',
            chatSendingTo: ' a ',
            chatSelectManager: 'Selecciona al menos un manager para enviar el mensaje.',
            sendResultTitle: 'Resultado del envío',
            sendSuccessMessage: 'Mensaje enviado con éxito a',
            sendSuccessManagers: 'manager(s):',
            cancelConfirmMessage: 'Al cancelar, esta ventana dejará de aparecer en esta jornada. ¿Estás seguro?',
            cancelConfirmNo: 'No',
            cancelConfirmYes: 'Sí',
            managersNotPlayed: 'Managers que aún no han jugado',
            missingToPlay: 'Faltan jugar',
            missingOf: ' de ',
            missingManagers: 'manager(s):',
            loadingList: 'Cargando lista...',
            deselectManagers: 'Desmarca los managers que NO deben recibir el mensaje.',
            sendMessageBtn: 'Enviar mensaje',
            mainMember: '(Miembro Clave)',
            errorRoundAlreadyGenerated: 'Error: La tabla de la Jornada',
            errorRoundAlreadyGeneratedSuffix: 'ya fue generada'
        }
    };

    function detectLanguage() {
        // Tentar detectar idioma da página ManagerZone
        const html = document.documentElement.innerHTML;

        // Procurar pela bandeira de idioma no HTML
        const flagMatch = html.match(/flags\/16\/([a-z]{2})\.png/);
        if (flagMatch) {
            const langCode = flagMatch[1];
            if (TRANSLATIONS[langCode]) return langCode;
        }

        // Tentar detectar pelo atributo lang
        const langAttr = document.documentElement.lang;
        if (langAttr) {
            const langCode = langAttr.substring(0, 2);
            if (TRANSLATIONS[langCode]) return langCode;
        }

        // Fallback para português
        return 'pt';
    }

    function getLanguage() {
        const saved = GM_getValue(LANGUAGE_KEY, null);
        if (saved && TRANSLATIONS[saved]) return saved;
        const detected = detectLanguage();
        GM_setValue(LANGUAGE_KEY, detected);
        return detected;
    }

    function setLanguage(lang) {
        if (TRANSLATIONS[lang]) {
            GM_setValue(LANGUAGE_KEY, lang);
            return true;
        }
        return false;
    }

    function t(key) {
        const lang = getLanguage();
        return TRANSLATIONS[lang][key] || TRANSLATIONS.pt[key] || key;
    }

    function translateSettingsPanel(sport) {
        const panel = document.getElementById('zoe-clash-settings');
        if (!panel) return;

        const s = getClashSettings(sport);

        // Traduções específicas por elemento ID - usar textContent em vez de replace
        const elementTranslations = {
            'zoe-cfg-cols-wrap': function(el) {
                const label = el.querySelector('div[style*="font-weight:bold"]');
                if (label) label.textContent = t('visibleColumns');
            },
            'zoe-cfg-ask-label': function(el) {
                // Reconstruir o label completamente
                const checkbox = el.querySelector('input');
                const checked = checkbox ? checkbox.checked : false;
                el.innerHTML = `<input type="checkbox" id="zoe-cfg-askBeforePost"${checked ? ' checked' : ''} style="cursor:pointer"> ${t('askBefore')}`;
            },
            'zoe-cfg-guestbook-label': function(el) {
                el.textContent = t('message');
            },
            'zoe-cfg-chat-label': function(el) {
                // Reconstruir o label completamente
                const checkbox = el.querySelector('input');
                const checked = checkbox ? checkbox.checked : false;
                el.innerHTML = `${t('chat')}<input type="checkbox" id="zoe-cfg-chatToManagers"${checked ? ' checked' : ''} style="cursor:pointer;width:16px;height:16px;flex-shrink:0">`;
            },
            'zoe-cfg-autoMsg-label': function(el) {
                el.textContent = t('autoMessage');
            },
            'zoe-cfg-sugestao-link': function(el) {
                el.textContent = t('suggestions');
            },
            'zoe-clash-cfg-save': function(el) {
                el.textContent = t('save');
            },
            'zoe-cfg-quality-label': function(el) {
                el.textContent = t('quality');
            }
        };

        // Aplicar traduções por elemento
        Object.keys(elementTranslations).forEach(id => {
            const el = panel.querySelector('#' + id);
            if (el) elementTranslations[id](el);
        });

        // Atualizar textos específicos por ID ou seletores mais precisos
        const specificTranslations = [
            { id: 'zoe-cfg-tableWidth', parentLabel: true, translation: t('tableWidth') },
            { id: 'zoe-cfg-imgSize', parentLabel: true, translation: t('resolution') },
            { id: 'zoe-cfg-imgExpiration', parentLabel: true, translation: t('deleteImageAfter') },
            { id: 'zoe-cfg-clashType', parentLabel: true, translation: t('clashType') },
            { id: 'zoe-cfg-teamsOffered', parentLabel: true, translation: t('teamsOffered') },
            { id: 'zoe-cfg-showUsers', parentLabel: true, translation: t('showUsers') }
        ];

        specificTranslations.forEach(item => {
            const select = panel.querySelector('#' + item.id);
            if (select && item.parentLabel) {
                const label = select.parentElement.querySelector('div[style*="font-weight:bold"]');
                if (label) label.textContent = item.translation;
            }
        });

        // Atualizar textos "Auto?" e relacionados
        const autoLabels = panel.querySelectorAll('span[style*="font-weight:bold;color:#ccc"]');
        autoLabels.forEach(el => {
            const currentText = el.textContent.trim();
            if (currentText === 'Auto?' || currentText === '¿Auto?') {
                el.textContent = t('auto');
            }
        });

        // Atualizar textos "Executar" e "horas antes"
        const smallLabels = panel.querySelectorAll('span[style*="font-size:11px;color:#888"]');
        smallLabels.forEach(el => {
            const currentText = el.textContent.trim();
            if (currentText === 'Executar' || currentText === 'Run') {
                el.textContent = t('run');
            } else if (currentText.includes('horas antes') || currentText.includes('hours before')) {
                el.textContent = t('hoursBeforeNextRound');
            }
        });

        // Atualizar "Enviar para:"
        const sendToLabels = panel.querySelectorAll('span[style*="font-size:11px;color:#ccc"]');
        sendToLabels.forEach(el => {
            const currentText = el.textContent.trim();
            if (currentText === 'Enviar para:' || currentText === 'Send to:' || currentText === 'Send to::' || currentText === 'Enviar a:') {
                el.textContent = t('sendMessageTo') + ':';
            }
        });

        // Atualizar título
        const titleEl = panel.querySelector('b');
        if (titleEl) {
            const sportLabel = sport === 'soccer' ? t('soccer') : t('hockey');
            titleEl.textContent = t('configClash') + ' ' + sportLabel;
        }

        // Atualizar opções do clash type
        const clashTypeSelect = panel.querySelector('#zoe-cfg-clashType');
        if (clashTypeSelect) {
            const options = [
                { value: 'elo', label: t('elo') },
                { value: 'best', label: t('best') },
                { value: 'offer', label: t('offer') }
            ];
            clashTypeSelect.innerHTML = options.map(o =>
                `<option value="${o.value}" ${s.clashType === o.value ? 'selected' : ''}>${o.label}</option>`
            ).join('');
        }

        // Atualizar opções de tamanho de imagem
        const imgSizeSelect = panel.querySelector('#zoe-cfg-imgSize');
        if (imgSizeSelect) {
            const options = [
                { value: 'small', label: t('small') },
                { value: 'normal', label: t('normal') },
                { value: 'large', label: t('large') },
                { value: 'xlarge', label: t('xlarge') },
                { value: 'xxlarge', label: t('xxlarge') }
            ];
            imgSizeSelect.innerHTML = options.map(o =>
                `<option value="${o.value}" ${s.imgSize === o.value ? 'selected' : ''}>${o.label}</option>`
            ).join('');
        }

        // Atualizar opções de expiração
        const expSelect = panel.querySelector('#zoe-cfg-imgExpiration');
        if (expSelect) {
            const expOptions = [
                { value: 604800, label: t('after1Week') },
                { value: 1209600, label: t('after2Weeks') },
                { value: 1814400, label: t('after3Weeks') },
                { value: 2592000, label: t('after1Month') },
                { value: 5184000, label: t('after2Months') },
                { value: 7776000, label: t('after3Months') },
                { value: 15552000, label: t('after6Months') }
            ];
            expSelect.innerHTML = expOptions.map(o =>
                `<option value="${o.value}" ${s.imgExpiration === o.value ? 'selected' : ''}>${o.label}</option>`
            ).join('');
        }

        // Atualizar opções do board type
        const boardTypeSelect = panel.querySelector('#zoe-cfg-boardType');
        if (boardTypeSelect) {
            const boardOptions = [
                { value: 'none', label: t('none') },
                { value: 'open', label: t('open') },
                { value: 'federation', label: t('federationMembers') },
                { value: 'team', label: t('firstTeamMembers') }
            ];
            boardTypeSelect.innerHTML = boardOptions.map(o =>
                `<option value="${o.value}" ${s.boardType === o.value ? 'selected' : ''}>${o.label}</option>`
            ).join('');
        }

        // Atualizar colunas visíveis
        const colLabels = panel.querySelectorAll('.zoe-cfg-col-cb');
        const colTranslations = {
            'showTeams': t('teamsUsers'),
            'showElo': t('showElo'),
            'showLmv': t('showLmv'),
            'showStats': t('pointsMatches')
        };
        colLabels.forEach(cb => {
            const key = cb.value;
            if (colTranslations[key]) {
                const label = cb.parentElement;
                label.innerHTML = `<input type="checkbox" class="zoe-cfg-col-cb" value="${key}" ${cb.checked ? 'checked' : ''} style="margin-right:6px">${colTranslations[key]}`;
            }
        });

        // Atualizar contador de colunas
        const colsTrigger = panel.querySelector('#zoe-cfg-cols-trigger');
        const colsCbs = panel.querySelectorAll('.zoe-cfg-col-cb');
        if (colsTrigger && colsCbs.length > 0) {
            const n = panel.querySelectorAll('.zoe-cfg-col-cb:checked').length;
            colsTrigger.textContent = n + ' de ' + colsCbs.length + ' ' + t('selectedCount');
        }

        // Atualizar aviso de imagem
        const warnEl = panel.querySelector('#zoe-cfg-no-image-warn');
        if (warnEl) {
            warnEl.textContent = t('noImageWarning');
        }

        // Atualizar opções show users
        const showUsersSelect = panel.querySelector('#zoe-cfg-showUsers');
        if (showUsersSelect) {
            const options = [
                { value: 'false', label: t('teams') },
                { value: 'true', label: t('users') }
            ];
            showUsersSelect.innerHTML = options.map(o =>
                `<option value="${o.value}" ${s.showUsers === (o.value === 'true') ? 'selected' : ''}>${o.label}</option>`
            ).join('');
        }

        // Atualizar tooltip do chat
        const chatTooltip = panel.querySelector('#zoe-cfg-chat-tooltip');
        if (chatTooltip) {
            chatTooltip.textContent = t('chatTooltip');
        }
    }

    // --- Update Checker ---
    // Versão lida diretamente do cabeçalho @version (só é preciso alterar aí)
    const SCRIPT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version)
        ? String(GM_info.script.version)
        : 'desconhecida';
    const SCRIPT_ID = '588299';
    const UPDATE_CHECK_KEY = 'zoe_last_update_check';
    const UPDATE_CHECK_VERSION_KEY = 'zoe_last_update_check_version';
    const UPDATE_SNOOZE_KEY = 'zoe_update_snooze_until';
    const UPDATE_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // 1 semana
    const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/19rui90/zoe_clash.user/main/zoe_clash.user.js'; // <-- URL raw do teu .user.js no GitHub
    const GITHUB_REPO = '19rui90/zoe_clash.user';

    function compareVersions(installed, latest) {
        const a = String(installed).split('.').map(n => parseInt(n, 10) || 0);
        const b = String(latest).split('.').map(n => parseInt(n, 10) || 0);
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i++) {
            const x = a[i] || 0, y = b[i] || 0;
            if (x < y) return -1;
            if (x > y) return 1;
        }
        return 0;
    }

    async function checkForUpdates(manual = false) {
        try {
            if (location.hostname !== 'www.managerzone.com') return;
            const lastCheck = GM_getValue(UPDATE_CHECK_KEY, 0);
            const lastCheckVersion = GM_getValue(UPDATE_CHECK_VERSION_KEY, '');
            const now = Date.now();
            if (!manual && now - lastCheck < 10000 && lastCheckVersion === SCRIPT_VERSION) {
                return;
            }

            console.log('ZOE Update: a verificar atualizações...' + (manual ? ' (manual)' : ''));
            let remoteVersion = null;

            // GitHub raw: ler a @version (fonte sem bloqueio ouo.io/CORS)
            try {
                if (!GITHUB_RAW_URL) {
                    console.log('ZOE Update: GITHUB_RAW_URL não definido — a usar só a atualização nativa do Tampermonkey');
                } else {
                    const rawUrl = GITHUB_RAW_URL + (GITHUB_RAW_URL.indexOf('?') >= 0 ? '&' : '?') + '_zoe=' + Date.now();
                    console.log('ZOE Update: a consultar raw (cache-buster) →', rawUrl);
                    const html = await new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: 'GET', url: rawUrl, timeout: 15000,
                            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                            onload: (r) => { if (r.status === 200 && r.responseText) resolve(r.responseText); else reject(new Error('status=' + r.status)); },
                            onerror: (e) => reject(e),
                            ontimeout: () => reject(new Error('Timeout'))
                        });
                    });
                    const m = html.match(/\/\/\s*@version\s+([\d.]+)/);
                    if (m) {
                        remoteVersion = m[1];
                        console.log('ZOE Update: versão detetada no GitHub →', remoteVersion);
                    } else {
                        console.log('ZOE Update: não foi possível extrair @version do GitHub');
                    }
                }
            } catch (e) {
                console.log('ZOE Update: erro ao contactar o GitHub:', e && e.message ? e.message : String(e));
            }

            if (!remoteVersion) {
                console.log('ZOE Update: não foi possível verificar (a atualização nativa do Tampermonkey continua ativa via @updateURL)');
                GM_setValue(UPDATE_CHECK_KEY, Date.now());
                GM_setValue(UPDATE_CHECK_VERSION_KEY, SCRIPT_VERSION);
                return;
            }

            GM_setValue(UPDATE_CHECK_KEY, Date.now());
            GM_setValue(UPDATE_CHECK_VERSION_KEY, SCRIPT_VERSION);

            if (compareVersions(SCRIPT_VERSION, remoteVersion) < 0) {
                const snoozeUntil = GM_getValue(UPDATE_SNOOZE_KEY, 0);
                if (!manual && snoozeUntil > Date.now()) {
                    console.log('ZOE Update: nova versão disponível!', SCRIPT_VERSION, '->', remoteVersion, '— aviso silenciado até', new Date(snoozeUntil).toLocaleString());
                } else {
                    if (manual && snoozeUntil > Date.now()) {
                        console.log('ZOE Update: verificação manual — silêncio do aviso ignorado');
                    }
                    console.log('ZOE Update: nova versão disponível!', SCRIPT_VERSION, '->', remoteVersion);
                    showUpdateNotification(remoteVersion);
                }
            } else {
                console.log('ZOE Update: script está atualizado (v' + SCRIPT_VERSION + ')');
            }
        } catch(e) {
            console.log('ZOE Update: erro ao verificar atualizações:', e && e.message ? e.message : String(e));
        }
    }

    async function fetchVersionsFromCommits() {
        const out = [];
        try {
            const commits = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://api.github.com/repos/' + GITHUB_REPO + '/commits?path=zoe_clash.user.js&per_page=100',
                    timeout: 15000,
                    headers: { 'Accept': 'application/vnd.github+json' },
                    onload: (r) => { if (r.status === 200 && r.responseText) resolve(JSON.parse(r.responseText)); else reject(new Error('status=' + r.status)); },
                    onerror: (e) => reject(e),
                    ontimeout: () => reject(new Error('Timeout'))
                });
            });
            const seen = new Set();
            for (const c of commits.slice(0, 30)) {
                const sha = c && c.sha;
                if (!sha) continue;
                try {
                    const text = await new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: 'GET',
                            url: 'https://raw.githubusercontent.com/' + GITHUB_REPO + '/' + sha + '/zoe_clash.user.js',
                            timeout: 15000,
                            onload: (r) => { if (r.status === 200 && r.responseText) resolve(r.responseText); else reject(new Error('status=' + r.status)); },
                            onerror: (e) => reject(e),
                            ontimeout: () => reject(new Error('Timeout'))
                        });
                    });
                    const m = text.match(/\/\/\s*@version\s+([\d.]+)/);
                    if (!m) continue;
                    if (seen.has(m[1])) continue;
                    seen.add(m[1]);
                    out.push({ tag: sha, name: 'v' + m[1] });
                } catch (e) {}
            }
        } catch (e) {
            console.log('ZOE VersionHistory: commits falhou:', e && e.message ? e.message : String(e));
        }
        out.sort((a, b) => compareVersions(b.name.replace(/^v/, ''), a.name.replace(/^v/, '')));
        return out;
    }

    async function fetchAvailableVersions() {
        const out = [];
        try {
            const data = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://api.github.com/repos/' + GITHUB_REPO + '/releases',
                    timeout: 15000,
                    headers: { 'Accept': 'application/vnd.github+json' },
                    onload: (r) => { if (r.status === 200 && r.responseText) resolve(JSON.parse(r.responseText)); else reject(new Error('status=' + r.status)); },
                    onerror: (e) => reject(e),
                    ontimeout: () => reject(new Error('Timeout'))
                });
            });
            for (const rel of data) { if (rel.tag_name) out.push({ tag: rel.tag_name, name: rel.name || rel.tag_name }); }
        } catch (e) {
            console.log('ZOE VersionHistory: releases falhou:', e && e.message ? e.message : String(e));
        }
        if (out.length === 0) {
            try {
                const data = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: 'https://api.github.com/repos/' + GITHUB_REPO + '/tags',
                        timeout: 15000,
                        onload: (r) => { if (r.status === 200 && r.responseText) resolve(JSON.parse(r.responseText)); else reject(new Error('status=' + r.status)); },
                        onerror: (e) => reject(e),
                        ontimeout: () => reject(new Error('Timeout'))
                    });
                });
                for (const tg of data) { if (tg.name) out.push({ tag: tg.name, name: tg.name }); }
            } catch (e) {
                console.log('ZOE VersionHistory: tags falhou:', e && e.message ? e.message : String(e));
            }
        }
        if (out.length === 0) {
            const fromCommits = await fetchVersionsFromCommits();
            if (fromCommits.length > 0) {
                console.log('ZOE VersionHistory: versões obtidas dos commits =', fromCommits.map(v => v.name));
                out.push(...fromCommits);
            }
        }
        return out;
    }

    function rawUrlForTag(tag) {
        return 'https://raw.githubusercontent.com/' + GITHUB_REPO + '/' + encodeURIComponent(tag) + '/zoe_clash.user.js';
    }

    async function showVersionHistory() {
        const modalId = 'zoe-version-history';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000001;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = '<div style="background:#fff;color:#222;padding:20px 24px;border-radius:10px;max-width:380px;width:90%;max-height:80%;overflow:auto;font-family:Segoe UI,Arial,sans-serif;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><b style="font-size:16px">' + t('versionHistory') + '</b><span style="cursor:pointer;font-size:20px" id="' + modalId + '-close">✕</span></div>' +
            '<div id="' + modalId + '-list" style="font-size:14px">A carregar...</div></div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal || e.target.id === modalId + '-close') modal.remove(); });
        const listEl = modal.querySelector('#' + modalId + '-list');
        try {
            const versions = await fetchAvailableVersions();
            if (versions.length === 0) {
                listEl.textContent = 'Nenhuma versão anterior disponível.';
            } else {
                const verOf = (v) => {
                    const m = String((v.name || '') + ' ' + (v.tag || '')).match(/(\d+(?:\.\d+)+)/);
                    return m ? m[1] : null;
                };
                let latestVersion = null;
                versions.forEach(v => {
                    const ver = verOf(v);
                    if (ver && (!latestVersion || compareVersions(ver, latestVersion) > 0)) latestVersion = ver;
                });
                listEl.innerHTML = '';
                versions.forEach(v => {
                    const item = document.createElement('div');
                    item.style.cssText = 'padding:8px 10px;border:1px solid #eee;border-radius:6px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;';
                    const ver = verOf(v);
                    const isCurrent = ver && compareVersions(ver, SCRIPT_VERSION) === 0;
                    const isLatest = ver && latestVersion && compareVersions(ver, latestVersion) === 0;
                    let suffix = '';
                    let color = '';
                    if (isCurrent) {
                        suffix = ' (versão atual)';
                        color = isLatest ? '#2e7d32' : '#c62828';
                    } else if (isLatest) {
                        suffix = ' (versão mais recente)';
                        color = '#2e7d32';
                    }
                    const labelStyle = color ? 'color:' + color + ';font-weight:bold;' : '';
                    item.innerHTML = '<span style="' + labelStyle + '">' + (v.name || v.tag) + suffix + '</span>';
                    const btn = document.createElement('button');
                    btn.textContent = 'Instalar';
                    btn.style.cssText = 'background:#4CAF50;color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;';
                    btn.onclick = () => { window.open(rawUrlForTag(v.tag), '_blank'); };
                    item.appendChild(btn);
                    listEl.appendChild(item);
                });
            }
        } catch (e) {
            listEl.textContent = 'Erro ao carregar versões: ' + (e && e.message ? e.message : String(e));
        }
    }
    window.showVersionHistory = showVersionHistory;

    function showUpdateNotification(remoteVersion) {
        // Não mostrar notificação se já estiver aberta
        if (document.getElementById('zoe-update-notification')) return;

        // Detectar desporto atual para definir cor
        const sport = detectCurrentSport();
        const sportColors = {
            soccer: {
                bg: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
                shadow: 'rgba(76, 175, 80, 0.4)',
                button: '#4CAF50',
                icon: '⚽'
            },
            hockey: {
                bg: 'linear-gradient(135deg, #2196F3 0%, #1565C0 100%)',
                shadow: 'rgba(33, 150, 243, 0.4)',
                button: '#2196F3',
                icon: '🏒'
            }
        };
        const colors = sportColors[sport] || sportColors.soccer;

        const notification = document.createElement('div');
        notification.id = 'zoe-update-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors.bg};
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: 0 6px 20px ${colors.shadow};
            z-index: 9999999;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
            max-width: 320px;
            animation: slideIn 0.3s ease-out;
        `;

        notification.innerHTML = `
            <style>
                @keyframes slideIn {
                    from { transform: translateX(400px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
            </style>
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 24px; margin-right: 10px; animation: pulse 2s infinite;">${colors.icon} 🚀</span>
                <div style="font-weight: bold; font-size: 16px;">${t('newVersionAvailable')}</div>
            </div>
            <div style="margin-bottom: 12px; opacity: 0.9;">
                <div>${t('currentVersion')}: <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px;">${SCRIPT_VERSION}</span></div>
                <div style="margin-top: 4px;">${t('remoteVersionLabel')}: <span style="background: rgba(255,255,255,0.3); padding: 2px 8px; border-radius: 4px; font-weight: bold;">${remoteVersion}</span></div>
            </div>
            <div style="display: flex; gap: 10px;">
                <a href="${GITHUB_RAW_URL || 'https://update.greasefork.org/scripts/' + SCRIPT_ID + '/ZOE-Clash-Screenshot.user.js'}"
                   target="_blank"
                   style="background: white; color: ${colors.button}; padding: 10px 20px;
                          border-radius: 8px; text-decoration: none; font-weight: bold;
                          display: inline-block; flex: 1; text-align: center; transition: transform 0.2s;"
                   onmouseover="this.style.transform='scale(1.05)'"
                   onmouseout="this.style.transform='scale(1)'">
                    Atualizar agora
                </a>
                <button id="zoe-update-ignore"
                        style="background: rgba(255,255,255,0.2); border: none; color: white;
                               padding: 10px 16px; border-radius: 8px; cursor: pointer;
                               transition: background 0.2s;"
                        onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                        onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                    Ignorar
                </button>
            </div>
            <div style="margin-top:8px;text-align:center;">
                <a href="javascript:void(0)" id="zoe-update-version-history" style="color:white;text-decoration:underline;font-size:13px;cursor:pointer;">${t('versionHistory')}</a>
            </div>
        `;
        document.body.appendChild(notification);

        const historyLink = notification.querySelector('#zoe-update-version-history');
        if (historyLink) {
            historyLink.onclick = (e) => {
                e.preventDefault();
                showVersionHistory();
            };
        }

        const ignoreBtn = notification.querySelector('#zoe-update-ignore');
        if (ignoreBtn) {
            ignoreBtn.onclick = () => {
                const until = Date.now() + UPDATE_SNOOZE_MS;
                GM_setValue(UPDATE_SNOOZE_KEY, until);
                console.log('ZOE Update: aviso ignorado até', new Date(until).toLocaleString());
                notification.remove();
            };
        }

        // Auto-remove após 1 minuto
        setTimeout(() => {
            const notif = document.getElementById('zoe-update-notification');
            if (notif) notif.remove();
        }, 60000);
    }

    if (location.hostname !== 'www.managerzone.com') return;

    // Verificação de atualizações: imediata no arranque e depois de hora a hora.
    // Só no Managerzone; se o body ainda não existir, espera pelo DOMContentLoaded.
    if (document.body) {
        checkForUpdates();
    } else {
        document.addEventListener('DOMContentLoaded', function() { checkForUpdates(); }, { once: true });
    }
    setInterval(checkForUpdates, 3600000);

    function detectCurrentSport() {
        const urlParam = (window.location.search.match(/changesport=(soccer|hockey)/) || [])[1];
        if (urlParam) { console.log('ZOE detectCurrentSport: sport via URL =', urlParam); return urlParam; }
        const html = document.documentElement.innerHTML;
        const m = html.match(/var\s+ajaxSport\s*=\s*"(soccer|hockey)"/);
        const sport = m ? m[1] : 'soccer';
        console.log('ZOE detectCurrentSport: sport =', sport);
        return sport;
    }

    function detectCurrentUser() {
        const headerUser = document.getElementById('header-username');
        if (headerUser) {
            const name = headerUser.textContent.trim();
            console.log('ZOE: Username detetado (header-username):', name);
            return name;
        }
        const navSelectors = ['nav', 'header', '.top-bar', '.nav-bar', '#header', '.user-menu', '#navigation'];
        for (const sel of navSelectors) {
            const container = document.querySelector(sel);
            if (container) {
                const link = container.querySelector('a[href*="p=profile"]');
                if (link) {
                    const name = link.textContent.trim();
                    console.log('ZOE: Username detetado (nav):', name);
                    return name;
                }
            }
        }
        const allLinks = document.querySelectorAll('a[href*="p=profile"]');
        for (const link of allLinks) {
            const rect = link.getBoundingClientRect();
            if (rect.top < 150) {
                const name = link.textContent.trim();
                console.log('ZOE: Username detetado (topo):', name);
                return name;
            }
        }
        const userEl = document.querySelector('.user-name, .username, #user-name, .logged-user, .profile-name');
        if (userEl) {
            const name = userEl.textContent.trim();
            console.log('ZOE: Username detetado (elemento):', name);
            return name;
        }
        console.log('ZOE: Nao foi possivel detetar o username atual');
        return null;
    }

    // --- Page Lock ---

    let _zoePageLockActive = false;
    let _zoeLockOverlay = null;

    // --- Tab ativa + lock entre separadores ---

        const RUN_LOCK_KEY = 'zoe_flow_run_lock';
    let _zoeRunLockToken = null;
    let _zoeRunLockHeartbeat = null;
    const RUN_LOCK_TTL = 2 * 60000; // 2 minutos — expira rapidamente se o script morrer
    const RUN_LOCK_HEARTBEAT = 30000; // renovar a cada 30 segundos

        function acquireRunLock() {
        try {
            const now = Date.now();
            const raw = GM_getValue(RUN_LOCK_KEY, 'null');
            let lock = null;
            try { lock = JSON.parse(raw); } catch(e) { lock = null; }

            console.log('ZOE AutoRun: estado do lock -', lock ? 'existe' : 'não existe',
                        lock ? '(token: ' + lock.token.substring(0,8) + '..., expiry: ' + new Date(lock.expiry).toLocaleString() + ')' : '');

            // Se o lock existe mas expirou, limpar
            if (lock && lock.expiry <= now) {
                console.log('ZOE AutoRun: lock expirado, a limpar...');
                GM_setValue(RUN_LOCK_KEY, 'null');
                lock = null;
            }

            // Se o lock existe de outro separador e ainda não expirou
            if (lock && lock.expiry > now && lock.token !== _zoeRunLockToken) {
                const lockAge = now - (lock.expiry - RUN_LOCK_TTL);
                console.log('ZOE AutoRun: lock ativo de outro separador (idade:', Math.round(lockAge/60000), 'min)');
                if (lockAge > RUN_LOCK_TTL) { // se expirou o TTL, assumir que está preso
                    console.log('ZOE AutoRun: lock antigo detetado (' + Math.round(lockAge/60000) + ' min), a limpar...');
                    GM_setValue(RUN_LOCK_KEY, 'null');
                    lock = null;
                } else {
                    return false;
                }
            }

            _zoeRunLockToken = Math.random().toString(36).slice(2) + now.toString(36);
            GM_setValue(RUN_LOCK_KEY, JSON.stringify({ token: _zoeRunLockToken, expiry: now + RUN_LOCK_TTL }));
            console.log('ZOE AutoRun: novo lock criado (token: ' + _zoeRunLockToken.substring(0,8) + '..., TTL: ' + (RUN_LOCK_TTL/60000) + ' min)');
            return true;
        } catch(e) {
            console.log('ZOE AutoRun: erro ao adquirir lock:', e.message, '- a permitir execução mesmo assim');
            return true;
        }
    }

    function refreshRunLock() {
        if (!_zoeRunLockToken) return;
        try {
            const now = Date.now();
            GM_setValue(RUN_LOCK_KEY, JSON.stringify({ token: _zoeRunLockToken, expiry: now + RUN_LOCK_TTL }));
        } catch(e) {}
    }

    function startRunLockHeartbeat() {
        stopRunLockHeartbeat();
        _zoeRunLockHeartbeat = setInterval(() => {
            if (!_zoeRunLockToken) { stopRunLockHeartbeat(); return; }
            refreshRunLock();
        }, RUN_LOCK_HEARTBEAT);
    }

    function stopRunLockHeartbeat() {
        if (_zoeRunLockHeartbeat) { clearInterval(_zoeRunLockHeartbeat); _zoeRunLockHeartbeat = null; }
    }

    function releaseRunLock() {
        try {
            stopRunLockHeartbeat();
            const raw = GM_getValue(RUN_LOCK_KEY, 'null');
            let lock = null;
            try { lock = JSON.parse(raw); } catch(e) { lock = null; }
            if (lock && lock.token === _zoeRunLockToken) {
                GM_setValue(RUN_LOCK_KEY, 'null');
                console.log('ZOE AutoRun: lock libertado');
            }
            _zoeRunLockToken = null;
        } catch(e) {}
    }

    function _zoeBeforeUnloadHandler(e) {
        e.preventDefault();
        e.returnValue = '';
    }

    function setPageLock(locked) {
        if (locked === _zoePageLockActive) return;
        _zoePageLockActive = locked;
        if (locked) {
            window.addEventListener('beforeunload', _zoeBeforeUnloadHandler);
            if (!_zoeLockOverlay) {
                _zoeLockOverlay = document.createElement('div');
                _zoeLockOverlay.id = 'zoe-page-lock';
                _zoeLockOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999998;background:rgba(0,0,0,0.15);pointer-events:none;display:flex;align-items:flex-start;justify-content:center;padding-top:60px';
                _zoeLockOverlay.innerHTML = '<div style="background:#1a1a2e;border:2px solid #e94560;border-radius:8px;padding:12px 24px;color:#eee;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;box-shadow:0 4px 16px rgba(0,0,0,0.5)">' + t('scriptRunningWarning') + '</div>';
                document.body.appendChild(_zoeLockOverlay);
            }
        } else {
            window.removeEventListener('beforeunload', _zoeBeforeUnloadHandler);
            if (_zoeLockOverlay && _zoeLockOverlay.parentNode) {
                _zoeLockOverlay.remove();
                _zoeLockOverlay = null;
            }
        }
    }

    // --- Clash Config ---

    function getClashConfigKey(sport) { return 'zoe_clash_config_' + sport; }
    function getClashConfig(sport) {
        try { return JSON.parse(GM_getValue(getClashConfigKey(sport), 'null')); } catch(e) { return null; }
    }
    function saveClashConfig(sport, cfg) { GM_setValue(getClashConfigKey(sport), JSON.stringify(cfg)); }
    function getClashSettings(sport) {
        const cfg = getClashConfig(sport);
        return {
            clashType: (cfg && cfg.clashType) || 'elo',
            teamsOffered: (cfg && cfg.teamsOffered) || 1,
            showUsers: (cfg && cfg.showUsers) || false,
            tableWidth: (cfg && cfg.tableWidth) || 90,
            imgSize: (cfg && cfg.imgSize) || 'large',
            showTeams: cfg ? cfg.showTeams !== false : true,
            showElo: cfg ? cfg.showElo !== false : true,
            showLmv: cfg ? cfg.showLmv !== false : true,
            showStats: cfg ? cfg.showStats !== false : true,
            guestbookTemplate: (cfg && cfg.guestbookTemplate) || '*image*',
            imgExpiration: (cfg && cfg.imgExpiration) || 604800,
            askBeforePost: cfg ? cfg.askBeforePost === true : false,
            imgScale: (cfg && cfg.imgScale) || 3,
            autoChineseSwitch: cfg ? cfg.autoChineseSwitch === true : true,
            boardType: (cfg && cfg.boardType) || 'federation',
            autoRun: cfg ? cfg.autoRun === true : false,
            autoRunBefore: (function(v) {
                if (v === 'none' || v === '' || v === null || v === undefined) return 21;
                if (typeof v === 'number') return Math.min(Math.max(Math.round(v), 0), 21);
                if (v === '1h') return 1; if (v === '3h') return 3; if (v === '6h') return 6; if (v === '12h') return 12;
                if (v === '1d') return 21; if (v === '2d') return 21;
                const n = parseInt(v, 10); return isNaN(n) ? 0 : Math.min(Math.max(n, 0), 21);
            })(cfg && cfg.autoRunBefore),
            autoMessage: cfg ? cfg.autoMessage === true : false,
            autoMessageBefore: (function(v) {
                if (v === null || v === undefined) return 24;
                const n = parseInt(v, 10); return isNaN(n) ? 24 : Math.min(Math.max(n, 12), 48);
            })(cfg && cfg.autoMessageBefore),
            autoMessageTemplate: (cfg && cfg.autoMessageTemplate) || '',
            chatToManagers: cfg ? cfg.chatToManagers === true : false,
            chatTemplate: (cfg && cfg.chatTemplate) || '',
            sendDiagnosticLogs: cfg ? cfg.sendDiagnosticLogs !== false : true
        };
    }

    // --- Federation ID ---

    function getFedIdStorage() {
        const raw = GM_getValue(FED_ID_KEY, null);
        if (!raw) return { soccer: null, hockey: null };
        if (typeof raw === 'string') {
            try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    if (parsed._version === 13) return parsed;
                    GM_setValue(FED_ID_KEY, JSON.stringify({ soccer: null, hockey: null, _version: 13 }));
                    return { soccer: null, hockey: null };
                }
            } catch(e) {}
            GM_setValue(FED_ID_KEY, JSON.stringify({ soccer: null, hockey: null, _version: 13 }));
            return { soccer: null, hockey: null };
        }
        if (typeof raw === 'object') {
            if (raw._version === 13) return raw;
            GM_setValue(FED_ID_KEY, JSON.stringify({ soccer: null, hockey: null, _version: 13 }));
            return { soccer: null, hockey: null };
        }
        return { soccer: null, hockey: null };
    }

    function getOurFedId() {
        const sport = detectCurrentSport();
        const ids = getFedIdStorage();
        return ids[sport] || null;
    }

    function saveOurFedId(id) {
        const sport = detectCurrentSport();
        const ids = getFedIdStorage();
        ids[sport] = String(id);
        ids._version = 13;
        GM_setValue(FED_ID_KEY, JSON.stringify(ids));
    }

    function detectFedIdFromHash() {
        const hash = window.location.hash;
        const url = window.location.href;
        console.log('ZOE DEBUG detectFedIdFromHash: URL =', url, '| hash =', hash);
        const match = hash.match(/fid=(\d+)/);
        if (match) {
            console.log('ZOE DEBUG detectFedIdFromHash: vai guardar fed ID', match[1], 'como nosso! URL:', url);
            saveOurFedId(match[1]);
            console.log('ZOE: Fed ID guardado do hash:', match[1]);
            return match[1];
        }
        console.log('ZOE DEBUG detectFedIdFromHash: nenhum fid no hash');
        return null;
    }

    function extractOurFedIdFromSelectVal() {
        const root = document.documentElement ? document.documentElement.outerHTML : (document.body ? document.body.innerHTML : '');
        const re = /\$\s*\(\s*(?:&quot;|"|')#federation-select(?:&quot;|"|')\s*\)\s*\.val\s*\(\s*["']?(\d+)["']?\s*\)/;
        const m = root.match(re);
        if (m && m[1]) {
            console.log('ZOE DEBUG extractOurFedIdFromSelectVal: Fed ID do $("#federation-select").val():', m[1]);
            saveOurFedId(m[1]);
            console.log('ZOE: Fed ID guardado do $("#federation-select").val():', m[1]);
            return m[1];
        }
        console.log('ZOE DEBUG extractOurFedIdFromSelectVal: padrão $("#federation-select").val(...) não encontrado');
        return null;
    }

    async function fetchOurFedId() {
        const stored = getOurFedId();
        console.log('ZOE DEBUG fetchOurFedId: stored value =', stored);
        const existing = stored;
        if (existing) {
            console.log('ZOE DEBUG fetchOurFedId: a usar stored ID =', existing, '| URL atual:', window.location.href);
            return existing;
        }
        const sport = detectCurrentSport();
        const url = 'https://www.managerzone.com/?p=federations&changesport=' + sport;
        console.log('ZOE: buscar fed ID via iframe de:', url);
        const ourId = await new Promise((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1';
            iframe.src = url;
            let resolved = false;
            const done = (id) => {
                if (resolved) return;
                resolved = true;
                clearInterval(poll);
                clearTimeout(timeout);
                iframe.remove();
                resolve(id);
            };
            let pollCount = 0;
            const poll = setInterval(() => {
                pollCount++;
                try {
                    const iframeUrl = iframe.contentWindow.location.href;
                    const hash = iframe.contentWindow.location.hash;
                    console.log('ZOE DEBUG iframe poll #' + pollCount + ': iframe URL =', iframeUrl, '| hash =', hash);
                    const match = hash.match(/fid=(\d+)/);
                    if (match) {
                        console.log('ZOE: Fed ID obtido do hash do iframe (' + sport + '):', match[1]);
                        done(match[1]);
                        return;
                    }
                } catch(e) {
                    console.log('ZOE DEBUG iframe poll #' + pollCount + ': erro ao ler iframe:', e.message);
                }
            }, 300);
            const timeout = setTimeout(() => {
                console.log('ZOE: timeout iframe (8s, ' + pollCount + ' polls), a tentar via GM_xmlhttpRequest...');
                clearInterval(poll);
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: (r) => {
                        console.log('ZOE DEBUG GM_xmlhttpRequest: response length =', r.responseText.length);
                        const logoRegex = /pic\.php\?type=federation(?:&amp;|&)fid=(\d+)/i;
                        const m = r.responseText.match(logoRegex);
                        if (m) {
                            console.log('ZOE: Fed ID obtido da logo fallback (' + sport + '):', m[1]);
                            done(m[1]);
                        } else {
                            console.log('ZOE: nenhum ID encontrado no fallback');
                            const hashMatch = r.responseText.match(/[#&]fid=(\d+)/);
                            if (hashMatch) {
                                console.log('ZOE: mas encontrei fid no HTML via regex alternativo:', hashMatch[1]);
                            }
                            done(null);
                        }
                    },
                    onerror: (e) => { console.log('ZOE DEBUG GM_xmlhttpRequest error:', e); done(null); },
                    ontimeout: () => { console.log('ZOE DEBUG GM_xmlhttpRequest timeout'); done(null); }
                });
            }, 8000);
            document.body.appendChild(iframe);
        });
        if (ourId) {
            saveOurFedId(ourId);
            console.log('ZOE: Fed ID guardado (' + sport + '):', ourId);
        }
        return ourId;
    }

    function extractRivalFedId(ourId, html) {
        if (!ourId) return null;
        if (html != null) {
            // parse do rival a partir de HTML (página fetch em background)
            const links = [];
            // Regex mais flexível para capturar qualquer link com fid=
            const re = /<a[^>]*href="[^"]*fid=(\d+)[^"]*"[^>]*>/gi;
            let m;
            while ((m = re.exec(html)) !== null) {
                const fid = m[1];
                if (!links.includes(fid)) links.push(fid);
            }
            console.log('ZOE Clash: extractRivalFedId (html) — fids encontrados:', links);
            const rival = links.find(fid => fid !== String(ourId));
            if (rival) return rival;
            console.log('ZOE Clash: extractRivalFedId (html) — no rival found');
            return null;
        }
        const links = document.querySelectorAll('.clash-standings .fed_link');
        console.log('ZOE Clash: extractRivalFedId — links found:', links.length);
        for (const link of links) {
            const hrefMatch = link.href.match(/fid=(\d+)/);
            console.log('ZOE Clash: extractRivalFedId — link href:', link.href, '| match:', hrefMatch ? hrefMatch[1] : null);
            if (hrefMatch && hrefMatch[1] !== ourId) return hrefMatch[1];
        }
        console.log('ZOE Clash: extractRivalFedId — no rival found');
        return null;
    }

    // Extrai os fids das federações da tabela #standings (clash-standings)
    function extractStandingsFids(html) {
        const fids = [];
        if (!html) return fids;
        const blockMatch = html.match(/<div id="standings">([\s\S]*?)<\/div>\s*<\/div>/i) || html.match(/id="standings"[\s\S]*?<\/table>/i);
        const block = blockMatch ? blockMatch[0] : html;
        const re = /<a class="fed_link"[^>]*href="[^"]*fid=(\d+)/gi;
        let m;
        while ((m = re.exec(block)) !== null) {
            if (!fids.includes(m[1])) fids.push(m[1]);
        }
        return fids;
    }

    // Vai buscar os fids da tabela #standings de uma página de clash (prev=1 ou atual)
    async function fetchStandingsFids(sport, prev) {
        const url = 'https://www.managerzone.com/?p=federations&sub=clash' + (prev ? '&prev=1' : '') + '&changesport=' + sport + '&_nocache=' + Date.now();
        console.log('ZOE Clash: fallback standings — a buscar ' + (prev ? 'prev=1' : 'atual') + ':', url);
        const html = await new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET', url: url, timeout: 15000,
                headers: { 'Referer': 'https://www.managerzone.com/?p=federations&sub=clash&changesport=' + sport },
                onload: (r) => resolve(r.responseText || ''),
                onerror: () => resolve(''), ontimeout: () => resolve('')
            });
        });
        const fids = extractStandingsFids(html);
        console.log('ZOE Clash: fallback standings — fids ' + (prev ? 'prev=1' : 'atual') + ' =', fids);
        return fids;
    }

    // Fallback: determina ourId pela interseção das tabelas #standings (prev=1 ∩ atual).
    // O fid comum às duas páginas é a nossa federação; o outro fid da página atual é o rival.
    async function resolveOurFedIdViaStandings(sport) {
        try {
            const prevFids = await fetchStandingsFids(sport, true);
            const curFids = await fetchStandingsFids(sport, false);
            if (prevFids.length < 2 || curFids.length < 2) {
                console.log('ZOE Clash: fallback standings — insuficientes fids (prev=' + prevFids.length + ', atual=' + curFids.length + ')');
                return null;
            }
            const ourId = prevFids.find(f => curFids.includes(f)) || null;
            if (!ourId) {
                console.log('ZOE Clash: fallback standings — nenhum fid em comum entre prev=1 e atual');
                return null;
            }
            const rivalId = curFids.find(f => f !== ourId) || null;
            console.log('ZOE Clash: fallback standings — ourId =', ourId, '| rivalId =', rivalId);
            return { ourId, rivalId };
        } catch(e) {
            console.error('ZOE Clash: erro no fallback standings:', e.message);
            return null;
        }
    }

    // --- Federation Data ---

    function getGoogleAppsScriptUrl() {
        return GOOGLE_APPS_SCRIPT_URL;
    }

    async function fetchAuthorizedUsersFromWebApp(sport, fedId) {
        const baseUrl = getGoogleAppsScriptUrl();
        if (!baseUrl) return { users: [], blacklist: [] };
        try {
            let url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'sport=' + encodeURIComponent(sport);
            if (fedId) url += '&fedId=' + encodeURIComponent(fedId);
            const text = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: (r) => resolve(r.responseText),
                    onerror: () => reject(new Error('Falha ao buscar utilizadores')),
                    ontimeout: () => reject(new Error('Timeout'))
                });
            });
            return JSON.parse(text);
        } catch(e) {
            console.error('ZOE: Erro ao buscar utilizadores do web app:', e.message);
            return { users: [], blacklist: [] };
        }
    }

    async function postFederationData(fedId, founder, president, sport, username) {
        const baseUrl = getGoogleAppsScriptUrl();
        console.log('ZOE postFedData: baseUrl =', baseUrl, '| fedId =', fedId, '| founder =', founder, '| president =', president, '| sport =', sport, '| username =', username);
        if (!baseUrl) {
            console.log('ZOE: Google Apps Script URL nao configurado, ignorar post de fed data');
            return;
        }
        try {
            const body = JSON.stringify({ fedId: fedId, founder: founder, president: president, sport: sport, username: username });
            console.log('ZOE postFedData: body =', body);
            const resp = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: baseUrl,
                    headers: { 'Content-Type': 'text/plain' },
                    data: body,
                    onload: (r) => {
                        console.log('ZOE postFedData: HTTP', r.status, '| response =', r.responseText);
                        resolve(r.responseText);
                    },
                    onerror: (e) => {
                        console.error('ZOE postFedData: onerror', e);
                        reject(new Error('Falha ao enviar dados da federação'));
                    },
                    ontimeout: () => {
                        console.error('ZOE postFedData: timeout');
                        reject(new Error('Timeout'));
                    }
                });
            });
            console.log('ZOE: Resposta do web app (postFederationData):', resp);
        } catch(e) {
            console.error('ZOE: Erro ao enviar dados da federação:', e.message);
        }
    }

    async function sendClashDiagnosticLog(payload) {
        const baseUrl = getGoogleAppsScriptUrl();
        if (!baseUrl) return false;
        try {
            const body = JSON.stringify(Object.assign({ action: REMOTE_LOG_ACTION }, payload));
            const resp = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: baseUrl,
                    headers: { 'Content-Type': 'text/plain' },
                    data: body,
                    timeout: 30000,
                    onload: (r) => resolve(r.responseText || ''),
                    onerror: () => reject(new Error('Falha ao enviar log')),
                    ontimeout: () => reject(new Error('Timeout ao enviar log'))
                });
            });
            const text = String(resp || '');
            let accepted = false;
            try {
                const json = JSON.parse(text);
                accepted = !!(json && (json.ok === true || json.success === true));
            } catch(e) {}
            if (!accepted && /(não encontrada|not found|error|erro)/i.test(text)) {
                console.warn('ZOE Log: servidor recusou o log — verificar doPost no Apps Script:', text.slice(0, 200));
                return false;
            }
            console.log('ZOE Log: diagnóstico enviado (' + body.length + ' bytes) — resposta:', text.slice(0, 120));
            return true;
        } catch(e) {
            console.warn('ZOE Log: não foi possível enviar diagnóstico:', e.message);
            return false;
        }
    }

    function extractFederationUsernames(html) {
        const container = document.createElement('div');
        container.innerHTML = html;
        const strongs = container.querySelectorAll('strong');
        let founder = '';
        let president = '';
        for (const strong of strongs) {
            const label = strong.textContent.trim().toLowerCase();
            if (label.includes('fundad')) {
                const next = strong.parentElement.querySelector('a[href*="p=profile"]');
                if (next) founder = next.textContent.trim();
            }
            if (label.includes('president')) {
                const next = strong.parentElement.querySelector('a[href*="p=profile"]');
                if (next) president = next.textContent.trim();
            }
        }
        console.log('ZOE: extractFederationUsernames — founder:', founder, '| president:', president);
        if (!founder && !president) {
            console.log('ZOE: extractFederationUsernames — WARNING: nenhum label <strong> encontrado. HTML snippet:', html.substring(0, 500));
        }
        return [founder, president];
    }

    // --- Image Upload ---

    function getImgbbKey() { return IMGBB_KEY; }

    async function uploadToImgbb(blob, expiration, customFileName) {
        const key = getImgbbKey();
        if (!key) throw new Error('API key do imgbb nao configurada. Abre a config do ZOE e adiciona a key.');
        const albumId = IMGBB_ALBUM_ID;
        const boundary = '----ZOE' + Date.now();
        const fileName = customFileName || 'zoe_clash_' + Date.now() + '.png';
        const encoder = new TextEncoder();
        const arrayBuffer = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsArrayBuffer(blob);
        });
        const parts = [];
        const addText = (t) => { parts.push(encoder.encode(t)); };
        addText('--' + boundary + '\r\nContent-Disposition: form-data; name="key"\r\n\r\n' + key + '\r\n');
        addText('--' + boundary + '\r\nContent-Disposition: form-data; name="album"\r\n\r\n' + albumId + '\r\n');
        if (expiration && expiration !== '0') {
            addText('--' + boundary + '\r\nContent-Disposition: form-data; name="expiration"\r\n\r\n' + expiration + '\r\n');
        }
        addText('--' + boundary + '\r\nContent-Disposition: form-data; name="image"; filename="' + fileName + '"\r\nContent-Type: image/png\r\n\r\n');
        parts.push(new Uint8Array(arrayBuffer));
        addText('\r\n--' + boundary + '--\r\n');
        const totalLen = parts.reduce((s, p) => s + p.byteLength, 0);
        const body = new Uint8Array(totalLen);
        let off = 0;
        for (const p of parts) { body.set(p, off); off += p.byteLength; }
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://api.imgbb.com/1/upload',
                headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary },
                data: body.buffer,
                onload: (resp) => {
                    const text = resp.responseText || '';
                    console.log('ZOE Upload: status =', resp.status, 'text =', text.substring(0, 500));
                    try {
                        const json = JSON.parse(text);
                        if (json && (json.success || json.status_code === 200) && json.data && json.data.url) { resolve(json.data.url); return; }
                        if (json && json.error) { reject(new Error('imgbb: ' + json.error.message)); return; }
                    } catch(e) {}
                    reject(new Error('Upload: ' + resp.status + ' ' + (text || 'empty')));
                },
                onerror: () => reject(new Error('Erro de rede')),
                ontimeout: () => reject(new Error('Timeout'))
            });
        });
    }

    async function uploadImage(blob, expiration, customFileName) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                return await uploadToImgbb(blob, expiration, customFileName);
            } catch (e) {
                console.log('ZOE Upload: tentativa', attempt + 1, 'falhou:', e.message);
                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
                } else {
                    throw e;
                }
            }
        }
    }

    // --- File Naming ---

    function buildClashFileName(clashSettings) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const dd = now.getDate();
        const mo = now.getMonth() + 1;
        const yy = String(now.getFullYear()).slice(-2);
        const typeMap = { elo: 'ELO', best: 'BEST', offer: 'SE' };
        const type = typeMap[clashSettings.clashType] || clashSettings.clashType;
        const teams = clashSettings.clashType === 'offer' ? '_' + clashSettings.teamsOffered : '';
        const cols = [];
        if (clashSettings.showTeams) cols.push(1);
        if (clashSettings.showElo) cols.push(2);
        if (clashSettings.showLmv) cols.push(3);
        if (clashSettings.showStats) cols.push(4);
        const colsStr = cols.length > 0 ? '_' + cols.join('.') + '_' : '_';
        const width = clashSettings.tableWidth;
        const sizeMap = { small: 'P', normal: 'N', large: 'G', xlarge: 'MG', xxlarge: 'E' };
        const size = sizeMap[clashSettings.imgSize] || clashSettings.imgSize;
        const expMap = { 604800: '1w', 1209600: '2w', 1814400: '3w', 2592000: '1m', 5184000: '2m', 7776000: '3m', 15552000: '6m' };
        const expiry = expMap[clashSettings.imgExpiration] || clashSettings.imgExpiration;
        const scale = clashSettings.imgScale || 1;
        return 'clash_' + hh + '.' + mm + '_' + dd + '.' + mo + '.' + yy + '_' + type + teams + colsStr + width + '_' + size + '_' + scale + 'x_' + expiry + '.png';
    }

    // --- Stats Card (*image_stats*) ---

    function fetchDivisionTable(sport, level, div) {
        return new Promise((resolve, reject) => {
            // Prioridade: usar level e div fornecidos (background), só depois tentar página atual
            if (level && div && level !== 'null' && div !== 'null') {
                const url = 'https://www.managerzone.com/?p=federations&sub=league&level=' + level + '&div=' + div + '&changesport=' + sport;
                console.log('ZOE Clash: division URL via AJAX:', url);
                GM_xmlhttpRequest({
                    method: 'GET', url: url,
                    onload: (r) => { console.log('ZOE Clash: division page AJAX loaded, length:', r.responseText.length); resolve(r.responseText); },
                    onerror: () => reject(new Error('Falha ao carregar tabela da divisão (AJAX)')),
                    ontimeout: () => reject(new Error('Timeout na tabela da divisão (AJAX)'))
                });
                return;
            }
            // Fallback: tentar obter da página atual
            const seasonEl = document.querySelector('.top-pane__season');
            if (seasonEl) {
                const divLink = seasonEl.querySelector('a[href*="tab=division"], a[href*="p=divisions"], a[href*="did="], a[href*="sub=league"]');
                if (divLink) {
                    console.log('ZOE Clash: division link found:', divLink.href);
                    GM_xmlhttpRequest({
                        method: 'GET', url: divLink.href,
                        onload: (r) => { console.log('ZOE Clash: division page loaded, length:', r.responseText.length); resolve(r.responseText); },
                        onerror: () => reject(new Error('Falha ao carregar tabela da divisão')),
                        ontimeout: () => reject(new Error('Timeout na tabela da divisão'))
                    });
                    return;
                }
            }
            reject(new Error('Não foi possível encontrar o link da tabela da divisão'));
        });
    }

    function extractPdDFromDivision(html, fedId) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const rows = doc.querySelectorAll('table.nice_table tr');
        for (const row of rows) {
            const link = row.querySelector('a.fed_link[href*="fid=' + fedId + '"]');
            if (link) {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 6) {
                    const pdd = parseInt(cells[5].textContent.trim(), 10);
                    return isNaN(pdd) ? null : pdd;
                }
            }
        }
        return null;
    }

    function extractClashTeamData(tableHtml) {
        const doc = new DOMParser().parseFromString(tableHtml, 'text/html');
        const rows = doc.querySelectorAll('tr');
        const teams = [];
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) continue;
            const nameEl = row.querySelector('.name_team, .name_rival');
            const userEl = row.querySelector('.user_team, .user_rival');
            const name = (nameEl ? nameEl.textContent : (userEl ? userEl.textContent : '')).trim();
            if (!name) continue;
            const elos = [];
            const lmvs = [];
            cells.forEach(c => {
                const t = c.textContent.trim();
                if (/^\d{3,5}$/.test(t)) elos.push(parseInt(t, 10));
                if (/^\d{1,2}$/.test(t) && parseInt(t, 10) <= 16) lmvs.push(parseInt(t, 10));
            });
            if (name && elos.length > 0) {
                teams.push({ name: name, elo: elos[0] || 0, lmv: lmvs[0] || 0 });
            }
        }
        return teams;
    }

    function calculateCombinedScore(ourTeams, rivalTeams, ourPdD, rivalPdD) {
        const ourAvgElo = ourTeams.length > 0 ? ourTeams.reduce((s, t) => s + t.elo, 0) / ourTeams.length : 1500;
        const rivalAvgElo = rivalTeams.length > 0 ? rivalTeams.reduce((s, t) => s + t.elo, 0) / rivalTeams.length : 1500;
        const ourAvgLmv = ourTeams.length > 0 ? ourTeams.reduce((s, t) => s + t.lmv, 0) / ourTeams.length : 5;
        const rivalAvgLmv = rivalTeams.length > 0 ? rivalTeams.reduce((s, t) => s + t.lmv, 0) / rivalTeams.length : 5;
        const eloFactor = Math.max(0, Math.min(1, 0.5 + (ourAvgElo - rivalAvgElo) / 600));
        const lmvFactor = Math.max(0, Math.min(1, ourAvgLmv / (ourAvgLmv + rivalAvgLmv)));
        const ourP = ourPdD || 150;
        const rivalP = rivalPdD || 150;
        const pddFactor = Math.max(0, Math.min(1, ourP / (ourP + rivalP)));
        const score = (eloFactor * 0.5 + lmvFactor * 0.25 + pddFactor * 0.25);
        const probability = Math.round(score * 100);
        let difficulty;
        if (probability >= 70) difficulty = 'Muito fácil';
        else if (probability >= 58) difficulty = 'Fácil';
        else if (probability >= 45) difficulty = 'Média';
        else if (probability >= 32) difficulty = 'Difícil';
        else difficulty = 'Muito difícil';
        let diffColor;
        if (probability >= 70) diffColor = '#4caf50';
        else if (probability >= 58) diffColor = '#8bc34a';
        else if (probability >= 45) diffColor = '#ff9800';
        else if (probability >= 32) diffColor = '#ff5722';
        else diffColor = '#f44336';
        return { probability: probability, difficulty: difficulty, diffColor: diffColor, ourAvgElo: Math.round(ourAvgElo), rivalAvgElo: Math.round(rivalAvgElo), ourAvgLmv: ourAvgLmv.toFixed(1), rivalAvgLmv: rivalAvgLmv.toFixed(1), ourPdD: ourP, rivalPdD: rivalP, eloFactor: Math.round(eloFactor * 100), lmvFactor: Math.round(lmvFactor * 100), pddFactor: Math.round(pddFactor * 100) };
    }

    function generateStatsHeaderHTML(rivalName, stats, clashSettings) {
        const hideCols = new Set();
        hideCols.add(0);
        hideCols.add(4);
        if (!clashSettings.showTeams) [1,2,3].forEach(c => hideCols.add(c));
        if (!clashSettings.showElo) [5,6,7].forEach(c => hideCols.add(c));
        if (!clashSettings.showLmv) [8,9].forEach(c => hideCols.add(c));
        if (!clashSettings.showStats) [10,11].forEach(c => hideCols.add(c));
        const cells = [];
        cells.push('<th style="display:none"></th>');
        cells.push('<th style="display:none"></th>');
        const groups = [
            { cols: [1,2,3], text: 'Rival: ' + rivalName },
            { cols: [5,6], text: 'Probabilidade de vitória: ' + stats.probability + '%' },
            { cols: [7,8], text: 'Dificuldade: <span style="color:' + stats.diffColor + '">' + stats.difficulty + '</span>' },
            { cols: [9,10,11], text: '' }
        ];
        for (const g of groups) {
            const vis = g.cols.filter(c => !hideCols.has(c));
            if (vis.length === 0) {
                for (let i = 0; i < g.cols.length; i++) cells.push('<th style="display:none"></th>');
            } else {
                const firstVisIdx = g.cols.indexOf(vis[0]);
                for (let i = 0; i < firstVisIdx; i++) cells.push('<th style="display:none"></th>');
                cells.push('<th colspan="' + vis.length + '" align="center">' + g.text + '</th>');
                const lastVisIdx = g.cols.indexOf(vis[vis.length - 1]);
                for (let i = lastVisIdx + 1; i < g.cols.length; i++) cells.push('<th style="display:none"></th>');
            }
        }
        return '<tr class="zoe-stats-header">' + cells.join('') + '</tr>';
    }

    // --- Guestbook ---

    function extractClashPageInfo(html) {
        const info = { round: '', season: '', division: '' };
        let text = '';
        let divLink = null;

        if (html) {
            // Parse do HTML fornecido (background)
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const seasonEl = tempDiv.querySelector('.top-pane__season');
            if (seasonEl) {
                text = seasonEl.textContent || '';
                divLink = seasonEl.querySelector('a[title*="ivis"]');
            }
        } else {
            // Parse da página atual (fallback)
            const el = document.querySelector('.top-pane__season');
            if (!el) return info;
            text = el.textContent || '';
            divLink = el.querySelector('a[title*="ivis"]');
        }

        if (!text) return info;

        const roundMatch = text.match(/Jornada\s+(\d+)/i);
        if (roundMatch) info.round = roundMatch[1];
        const seasonMatch = text.match(/[ÉE]poca\s+([\d.]+)/i);
        if (seasonMatch) info.season = seasonMatch[1];
        if (divLink) {
            const divMatch = divLink.title.match(/ivis[^]*?\s+([\d.]+)/i);
            if (divMatch) info.division = divMatch[1];
        } else {
            const divMatch = text.match(/Division\s+([\d.]+)/i);
            if (divMatch) info.division = divMatch[1];
        }
        console.log('ZOE Clash: pageInfo =', JSON.stringify(info));
        return info;
    }

    function showConfirmDialog(message, bottom) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999999;display:flex;align-items:' + (bottom ? 'flex-end' : 'center') + ';justify-content:center;padding:20px';
            const box = document.createElement('div');
            box.style.cssText = 'background:#1a1a2e;border:1px solid #555;border-radius:10px;padding:24px 32px;min-width:400px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.6);z-index:10000000';
            box.innerHTML = '<div style="font-size:15px;color:#eee;margin-bottom:20px">' + message + '</div>';
            const btnYes = document.createElement('button');
            btnYes.textContent = t('yes');
            btnYes.style.cssText = 'background:#00c853;color:#fff;border:none;padding:8px 28px;border-radius:5px;cursor:pointer;font-size:14px;margin-right:12px';
            btnYes.onclick = () => { overlay.remove(); resolve(true); };
            const btnNo = document.createElement('button');
            btnNo.textContent = t('no');
            btnNo.style.cssText = 'background:#f44336;color:#fff;border:none;padding:8px 28px;border-radius:5px;cursor:pointer;font-size:14px';
            btnNo.onclick = () => { overlay.remove(); resolve(false); };
            overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
            box.appendChild(btnYes);
            box.appendChild(btnNo);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
        });
    }

    // --- Tabela de confrontos StatsXente (*elo*) ---

    function parseClashMatchupTable(html) {
        const rows = [];
        if (!html) return rows;
        const tableRe = /<table\b[^>]*\bshow444\b[^>]*>([\s\S]*?)<\/table>/i;
        const tm = html.match(tableRe);
        const body = tm ? tm[1] : html;
        const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let tr;
        while ((tr = trRe.exec(body)) !== null) {
            const rowHtml = tr[1];
            if (!/class\s*=\s*["']?(?:user_team|name_team)\b/i.test(rowHtml)) continue;
            const cells = [];
            const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            let td;
            while ((td = tdRe.exec(rowHtml)) !== null) cells.push(td[1]);
            if (cells.length < 10) continue;
            const clean = (s) => (s || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
            const cleanNum = (s) => clean(s).replace(/\./g, ' ');
            rows.push({
                user: clean(cells[0]),
                team: clean(cells[1]),
                rivalTeam: clean(cells[3]),
                rivalUser: clean(cells[4]),
                eloEquipa: cleanNum(cells[5]),
                eloAdversario: cleanNum(cells[6]),
                eloDiff: cleanNum(cells[7]),
                lmvEquipa: cleanNum(cells[8]),
                lmvAdversario: cleanNum(cells[9])
            });
        }
        return rows;
    }

    function parseLmvNum(s) {
        return parseInt(String(s || '').replace(/[^\d]/g, ''), 10) || 0;
    }

    function formatLmvDiff(n) {
        const neg = n < 0;
        const abs = String(Math.abs(n));
        let out = '';
        for (let i = 0; i < abs.length; i++) {
            if (i > 0 && (abs.length - i) % 3 === 0) out += ' ';
            out += abs[i];
        }
        return (n === 0 ? '' : (neg ? '-' : '+')) + out;
    }

    function formatEloDiff(s) {
        const str = String(s || '').trim();
        if (!str || str === '0' || str.charAt(0) === '-') return str;
        return '+' + str;
    }

    function buildEloBlock(html) {
        try {
            const rows = parseClashMatchupTable(html);
            if (!rows.length) return '';
            const lines = [];
            for (const r of rows) {
                const lmvDiff = formatLmvDiff(parseLmvNum(r.lmvEquipa) - parseLmvNum(r.lmvAdversario));
                lines.push(r.user + ' (' + r.team + ') - ELO (' + r.eloEquipa + ') - LMV (' + r.lmvEquipa + ')');
                lines.push(r.rivalUser + ' (' + r.rivalTeam + ') - ELO (' + r.eloAdversario + ') - LMV (' + r.lmvAdversario + ')');
                lines.push('Resumo: ELO (' + r.eloDiff + ') - LMV (' + lmvDiff + ')');
                lines.push('');
            }
            return lines.join('\n').trim();
        } catch(e) {
            console.warn('ZOE Clash: erro ao gerar bloco ELO:', e.message);
            return '';
        }
    }

    // códigos por confronto: *user*, *user_rival*, *team*, *team_rival*, *elo*, *elo_rival*, *LMV*, *LMV_rival*, *elo_dif*, *LMV_dif*
    function renderMatchupRow(template, r) {
        const lmvDiff = formatLmvDiff(parseLmvNum(r.lmvEquipa) - parseLmvNum(r.lmvAdversario));
        return template
            .replace(/\*user_rival\*/g, r.rivalUser)
            .replace(/\*user\*/g, r.user)
            .replace(/\*team_rival\*/g, r.rivalTeam)
            .replace(/\*team\*/g, r.team)
            .replace(/\*elo_rival\*/g, r.eloAdversario)
            .replace(/\*elo_dif\*/g, formatEloDiff(r.eloDiff))
            .replace(/\*elo\*/g, r.eloEquipa)
            .replace(/\*LMV_rival\*/g, r.lmvAdversario)
            .replace(/\*LMV_dif\*/g, lmvDiff)
            .replace(/\*LMV\*/g, r.lmvEquipa);
    }

    function renderMatchupCodes(template, rows) {
        if (!rows || !rows.length) return null;
        if (!/\*(user|user_rival|team|team_rival|elo|elo_rival|LMV|LMV_rival|elo_dif|LMV_dif)\*/.test(template)) return null;
        return rows.map(r => renderMatchupRow(template, r)).join('\n');
    }

        function buildGuestbookMessage(template, pageInfo, imageUrlPlain, eloBlock, eloRows, isPreview, imageUrlStats) {
        if (!template || !template.trim()) return '';
        if (!imageUrlStats) imageUrlStats = imageUrlPlain;
        let msg = template.replace(/\*round\*/g, pageInfo.round || '?')
                          .replace(/\*season\*/g, pageInfo.season || '?')
                          .replace(/\*division\*/g, pageInfo.division || '?')
                          .replace(/\*rival\*/g, pageInfo.rival || '');
        const perMatchup = renderMatchupCodes(msg, eloRows);
        if (perMatchup !== null) {
            msg = perMatchup;
        } else {
            msg = msg.replace(/\*elo\*/g, eloBlock || '');
        }
        if (imageUrlPlain) {
            msg = msg.replace(/\*image\*/g, '[img]' + imageUrlPlain + '[/img]');
        } else {
            msg = msg.replace(/\*image\*/g, '');
        }
        if (imageUrlStats) {
            msg = msg.replace(/\*image_stats\*/g, '[img]' + imageUrlStats + '[/img]');
        } else {
            msg = msg.replace(/\*image_stats\*/g, '');
        }
        const urlForLink = imageUrlStats || imageUrlPlain || '';
        if (urlForLink) {
            if (isPreview) {
                msg = msg.replace(/\*url\*/g, '*url*');
            } else {
                msg = msg.replace(/\*url\*/g, urlForLink);
            }
        } else {
            msg = msg.replace(/\*url\*/g, '');
        }
        return msg;
    }

    // mensagem PM do chat: renderizada para UM confronto (o do manager destinatário)
    function buildChatMessage(template, pageInfo, row, managerName, managerNames) {
        if (!template || !template.trim()) return '';
        let msg = template.replace(/\*round\*/g, pageInfo.round || '?')
                          .replace(/\*season\*/g, pageInfo.season || '?')
                          .replace(/\*division\*/g, pageInfo.division || '?')
                          .replace(/\*rival\*/g, pageInfo.rival || '');
        if (row) {
            msg = renderMatchupRow(msg, row);
        } else {
            msg = msg.replace(/\*(?:user|user_rival|team|team_rival|elo|elo_rival|LMV|LMV_rival|elo_dif|LMV_dif)\*/g, '');
        }
        msg = msg.replace(/\*managers\*/g, managerNames || '')
                 .replace(/\*name\*/g, managerName || '');
        return msg;
    }

    async function postToGuestbook(message, sport, boardType, ourId) {
        const statusEl = document.getElementById('zoe-status');
        const bbcode = message;

        if (boardType === 'none' || !boardType) {
            if (statusEl) statusEl.textContent = t('postingToGuestbook');
            console.log('ZOE Guestbook: a postar no guestbook próprio');
            const pageResp = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://www.managerzone.com/?p=guestbook&changesport=' + sport,
                    onload: (r) => { console.log('ZOE Guestbook: página carregada, length =', r.responseText.length); resolve(r.responseText); },
                    onerror: () => reject(new Error('Falha ao carregar guestbook'))
                });
            });
            const actionMatch = pageResp.match(/action="\/ajax\.php\?p=messageBoard[^"]*ident_id=(\d+)/);
            const identId = actionMatch ? actionMatch[1] : null;
            console.log('ZOE Guestbook: identId =', identId);
            if (!identId) {
                if (statusEl) statusEl.innerHTML = '<span style="color:#f44336">Erro: ident_id não encontrado no guestbook.</span>';
                console.error('ZOE Guestbook: ident_id não encontrado no HTML');
                return;
            }
            const postData = 'msg=' + encodeURIComponent(bbcode) + '&sport=' + sport;
            console.log('ZOE Guestbook: POST para ident_id=' + identId);
            let postResp = null;
            let retries = 0;
            const maxRetries = 3;
            while (retries <= maxRetries) {
                postResp = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: 'https://www.managerzone.com/ajax.php?p=messageBoard&sub=write&template=1&ident_id=' + identId + '&sport=' + sport,
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        data: postData,
                        onload: (r) => { console.log('ZOE Guestbook: resposta =', r.status, r.responseText.substring(0, 300)); resolve(r); },
                        onerror: (e) => reject(new Error('Falha ao postar no guestbook'))
                    });
                });
                const body = (postResp.responseText || '').trim();
                if (postResp.status === 200 && body !== '["false"]' && body !== '' && body !== 'false') break;
                retries++;
                if (retries > maxRetries) break;
                console.warn('ZOE Guestbook: post rejeitado (' + body.substring(0, 60) + '), tentativa ' + retries + '/' + maxRetries + ' em 15s...');
                await new Promise(r => setTimeout(r, 15000));
            }
            const body = (postResp.responseText || '').trim();
            if (postResp.status === 200 && body !== '["false"]' && body !== '' && body !== 'false') {
                if (statusEl) statusEl.innerHTML = '<span style="color:#4caf50">' + t('imagePostedGuestbook') + '</span>';
                return true;
            } else {
                console.error('ZOE Guestbook: falha ao postar, resposta =', postResp.status, body.substring(0, 200));
                if (statusEl) statusEl.innerHTML = '<span style="color:#f44336">Erro ao postar no guestbook (resposta rejeitada).</span>';
                return false;
            }
        } else {
            const boardTypeMap = { open: 1, federation: 2, team: 3 };
            const bt = boardTypeMap[boardType];
            const boardLabel = { open: t('boardOpen'), federation: t('boardFederation'), team: t('boardTeam') }[boardType];
            if (statusEl) statusEl.textContent = t('postingToBoard') + ' "' + boardLabel + '"...';
            console.log('ZOE Board: a postar no painel federation — boardType =', bt, '(' + boardLabel + ')');

            try {
                const boardUrl = 'https://www.managerzone.com/ajax.php?p=messageBoard&template=6&sub=board_template&ident_id=' + ourId + '&board_type=' + bt + '&sport=' + sport;
                console.log('ZOE Board: a buscar template do painel —', boardUrl);
                const boardPageHtml = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: boardUrl,
                        headers: {
                            'Referer': 'https://www.managerzone.com/?p=federations&sub=clash&changesport=' + sport
                        },
                        onload: (r) => {
                            const txt = r.responseText || '';
                            console.log('ZOE Board: template length =', txt.length);
                            resolve(txt);
                        },
                        onerror: () => reject(new Error('Falha ao carregar painel')),
                        ontimeout: () => reject(new Error('Timeout ao carregar painel'))
                    });
                });
                if (!boardPageHtml || boardPageHtml.length < 100) {
                    console.warn('ZOE Board: template do painel "' + boardLabel + '" vazio (' + (boardPageHtml ? boardPageHtml.length : 0) + ' bytes), a tentar postar mesmo assim...');
                }
                const selectedMatch = boardPageHtml.match(/board_type[=:]\s*['"]?(\d)['"]?/);
                console.log('ZOE Board: board type no template =', selectedMatch ? selectedMatch[1] : 'não encontrado');

                const postData = 'msg=' + encodeURIComponent(bbcode) + '&board_type=' + bt;
                const postUrl = 'https://www.managerzone.com/ajax.php?p=messageBoard&sub=write&template=6&ident_id=' + ourId + '&board_type=' + bt + '&sport=' + sport;
                console.log('ZOE Board: POST para', postUrl);
                const postResp = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: postUrl,
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Referer': 'https://www.managerzone.com/?p=federations&sub=clash&changesport=' + sport
                        },
                        data: postData,
                        onload: (r) => {
                            const txt = r.responseText || '';
                            console.log('ZOE Board: resposta =', r.status, txt.substring(0, 300));
                            resolve(r);
                        },
                        onerror: () => reject(new Error('Falha ao postar no painel')),
                        ontimeout: () => reject(new Error('Timeout ao postar no painel'))
                    });
                });
                if (postResp.status !== 200) {
                    if (statusEl) statusEl.innerHTML = '<span style="color:#f44336">Erro no post: HTTP ' + postResp.status + '</span>';
                    return false;
                } else {
                    const respBody = (postResp.responseText || '').trim();
                    console.log('ZOE Board: resposta body =', respBody.substring(0, 300));
                    if (respBody === '["false"]' || respBody === '' || respBody === 'false') {
                        const errMsg = 'Erro ao postar em "' + boardLabel + '".<br>Verifica se tens permissão para escrever neste painel.';
                        console.error('ZOE Board:', errMsg);
                        if (statusEl) statusEl.innerHTML = '<span style="color:#f44336;font-weight:bold">' + errMsg + '</span>';
                        return false;
                    } else {
                        if (statusEl) statusEl.innerHTML = '<span style="color:#4caf50">' + t('imagePostedBoard') + ' "' + boardLabel + '"!</span>';
                        return true;
                    }
                }
            } catch(e) {
                console.error('ZOE Board: erro —', e.message);
                if (statusEl) statusEl.innerHTML = '<span style="color:#f44336">Erro ao postar no painel "' + boardLabel + '": ' + e.message + '</span>';
                return false;
            }
        }
    }

    // --- Existing Post Check ---

    async function checkExistingClashPost(sport, ourId, nextRound) {
        // TEMPORÁRIO: verificação dos 4 locais (guestbook, aberto, membros da federação, membros da 1ª equipa) desativada para testes.
        // Para reativar, pôr TEMP_DISABLE_EXISTING_POST_CHECK = false.
        const TEMP_DISABLE_EXISTING_POST_CHECK = false;
        try {
            if (TEMP_DISABLE_EXISTING_POST_CHECK) {
                console.log('ZOE Clash: [TEMPORÁRIO] verificação de mensagens existentes desativada');
                return null;
            }
            if (!nextRound) nextRound = await fetchNextRoundData(sport);
            if (!nextRound || !nextRound.ts) return null;
            const fmt = (d) => String(d.getDate()).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
            const targetDate = new Date(nextRound.ts);
            const dayBefore = new Date(targetDate);
            dayBefore.setDate(dayBefore.getDate() - 1);
            const targetDates = [fmt(targetDate), fmt(dayBefore)];
            console.log('ZOE Clash: a verificar mensagens existentes para jornada #' + nextRound.round + ' nas datas ' + targetDates.join(', '));

            const boards = [];
            const gbPage = await new Promise(resolve => {
                GM_xmlhttpRequest({
                    method: 'GET', url: 'https://www.managerzone.com/?p=guestbook&changesport=' + sport + '&_nocache=' + Date.now(),
                    onload: (r) => resolve(r.responseText || ''),
                    onerror: () => resolve(''), ontimeout: () => resolve('')
                });
            });
            const gbMatch = gbPage.match(/action="\/ajax\.php\?p=messageBoard[^"]*ident_id=(\d+)/);
            const gbUid = gbMatch ? gbMatch[1] : null;
            if (gbUid) {
                boards.push({ name: 'guestbook', url: 'https://www.managerzone.com/ajax.php?p=messageBoard&sub=read&template=1&ident_id=' + gbUid + '&offset=0&sport=' + sport });
            }
            const boardLabels = { 1: 'aberto (board_type=1)', 2: 'federacao (board_type=2)', 3: 'equipa (board_type=3)' };
            for (const bt of [1, 2, 3]) {
                boards.push({ name: boardLabels[bt], url: 'https://www.managerzone.com/ajax.php?p=messageBoard&sub=read&template=6&ident_id=' + ourId + '&board_type=' + bt + '&offset=0&sport=' + sport });
            }

            for (const board of boards) {
                let html;
                try {
                    html = await new Promise(resolve => {
                        GM_xmlhttpRequest({
                            method: 'GET', url: board.url,
                            onload: (r) => {
                                try {
                                    const txt = (r.responseText || '').trim();
                                    const arr = JSON.parse(txt);
                                    resolve(Array.isArray(arr) && typeof arr[0] === 'string' ? arr[0] : '');
                                } catch(e) { resolve(''); }
                            },
                            onerror: () => resolve(''), ontimeout: () => resolve('')
                        });
                    });
                } catch(e) { continue; }
                if (!html || html.length < 100) {
                    console.log('ZOE Clash: ' + board.name + ' — sem dados');
                    continue;
                }
                const msgRegex = /<div[^>]*id="board_message_container_(\d+)"[^>]*>[\s\S]*?<span class="date">([^<]*)<\/span>[\s\S]*?<div class="board_message">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
                let m;
                while ((m = msgRegex.exec(html)) !== null) {
                    const datePart = (m[2] || '').trim().split(' ')[0];
                    if (!datePart) continue;
                    const content = m[3] || '';
                    if (targetDates.includes(datePart) && (/ibb\.co/i.test(content) || /<img[^>]+src\s*=[^>]*ibb\.co/i.test(content))) {
                        console.log('ZOE Clash: mensagem com URL ibb.co encontrada em ' + board.name + ', data=' + datePart + ' — a saltar publicacao');
                        return nextRound.round;
                    }
                }
            }
            return null;
        } catch(e) {
            console.warn('ZOE Clash: erro ao verificar mensagens existentes:', e.message);
            return null;
        }
    }

    // --- Main Clash Flow ---

    async function startClashScreenshotFlow(autoRun) {
        const now = Date.now();
        if (startClashScreenshotFlow._running || now < (startClashScreenshotFlow._cooldownUntil || 0)) {
            console.log('ZOE Clash: fluxo já em curso ou em cooldown — a ignorar clique repetido (debounce)');
            return;
        }
        startClashScreenshotFlow._running = true;
                if (autoRun) {
            console.log('ZOE AutoRun: a verificar condições para execução...');
 const lockAcquired = acquireRunLock();
            console.log('ZOE AutoRun: lock adquirido =', lockAcquired);
            if (!lockAcquired) {
                console.log('ZOE AutoRun: outro separador está a executar o fluxo, a saltar');
                return;
            }
            startRunLockHeartbeat();
        }
        let flowImageGenerated = false;
        const flowImageUrls = {};
        let flowGuestbookPosted = null;
        let flowChatResult = { status: 'not-attempted' };
        let flowLogContext = null;
        let flowError = null;
        let flowOutcome = 'started';
        const flowTimings = {};
        const flowLogStartSeq = zoeLogSeq;
        const flowStartedAt = Date.now();
        setPageLock(true);
        try {
        const t0 = performance.now();
        const logTiming = (label) => {
            const ms = Math.round(performance.now() - t0);
            flowTimings[label] = ms;
            console.log('ZOE TIMING: ' + label + ' — ' + ms + 'ms');
        };
        let statusEl = document.getElementById('zoe-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'zoe-status';
            statusEl.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:9999999;padding:10px 20px;background:#1a1a2e;color:#eee;border:2px solid #e94560;border-radius:8px;font-family:Arial,sans-serif;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.5);min-width:650px;text-align:center';
            document.body.appendChild(statusEl);
        }
        if (statusEl) {
            if (autoRun) statusEl.innerHTML = '<span style="color:#4caf50">[AUTO]</span> ' + t('detectingFederations');
            else statusEl.textContent = t('detectingFederations');
        }
        console.log('ZOE Clash: iniciar fluxo' + (autoRun ? ' (AUTO)' : ''));
        console.log('ZOE DEBUG startFlow: URL =', window.location.href);
        console.log('ZOE DEBUG startFlow: stored IDs =', JSON.stringify(getFedIdStorage()));
        const sport = detectCurrentSport();
        flowLogContext = { sport: sport, ourId: null, rivalId: null, autoRun: !!autoRun, pageInfo: null, trigger: autoRun ? 'auto' : 'manual' };
        const clashCfg = getClashSettings(sport);
        if (!autoRun) {
            if (!clashCfg.guestbookTemplate || !clashCfg.guestbookTemplate.trim()) {
                const confirmed = await showConfirmDialog('Atenção: Campo de "Mensagem" vazio. Nenhuma mensagem será publicada no painel de mensagens.<br><br>Deseja continuar mesmo assim?');
                if (!confirmed) { flowOutcome = 'cancelled-empty-guestbook'; return; }
            } else if (!/\*image\*/.test(clashCfg.guestbookTemplate) && !/\*image_stats\*/.test(clashCfg.guestbookTemplate)) {
                const confirmed = await showConfirmDialog('Atenção: Campo de "Mensagem" sem o código <b>*image*</b> ou <b>*image_stats*</b>. Nenhuma imagem será enviada para o painel de mensagens.<br><br>Deseja continuar mesmo assim?');
                if (!confirmed) { flowOutcome = 'cancelled-no-image-placeholder'; return; }
            }
        }
        const webAppUrl = getGoogleAppsScriptUrl();

        let ourId = await fetchOurFedId();
        logTiming('fetchOurFedId');
        console.log('ZOE Clash: ourId =', ourId);
        if (flowLogContext) flowLogContext.ourId = ourId || null;
        if (!ourId) {
            flowOutcome = 'error-no-federation';
            flowError = 'Nenhuma federação encontrada';
            const storedIds = getFedIdStorage();
            const info = '<br><br><span style="font-size:11px;color:#aaa">IDs guardados — Futebol: <b style="color:#e94560">' + (storedIds.soccer || 'nenhum') + '</b> | Hoquei: <b style="color:#e94560">' + (storedIds.hockey || 'nenhum') + '</b></span>';
            if (statusEl) statusEl.innerHTML = '<span style="color:#f44336;font-weight:bold">Erro: Nenhuma federação encontrada. Contactar o user @ruisimoes</span>' + info;
            return;
        }
        // AJAX schedule data (rivalId, cid, pageInfo, rivalName)
        let scheduleData = null;
        try {
            scheduleData = await fetchNextRoundData(sport);
            logTiming('fetchNextRoundData');
            console.log('ZOE Clash: scheduleData =', JSON.stringify(scheduleData));
        } catch(e) {
            console.log('ZOE Clash: erro schedule AJAX:', e.message);
        }

        logTiming('checkBoards');
        {
            const existingRound = await checkExistingClashPost(sport, ourId, scheduleData);
            logTiming('checkExistingClashPost');
            if (existingRound) {
                flowOutcome = 'skipped-existing-round';
                if (statusEl) statusEl.innerHTML = '<span style="color:#ff9800">' + t('errorRoundAlreadyGenerated') + ' ' + existingRound + ' ' + t('errorRoundAlreadyGeneratedSuffix') + '</span>';
                console.log('ZOE Clash: jornada #' + existingRound + ' ja postada');
                if (autoRun) await scheduleAutoRun(sport, existingRound);
                return;
            }
        }

        logTiming('autorizacao');
        if (webAppUrl) {
            let founder = '';
            let president = '';
            const founderKey = 'zoe_founder_' + sport;
            const presKey = 'zoe_president_' + sport;
            founder = GM_getValue(founderKey, '');
            president = GM_getValue(presKey, '');
            if (founder && president) {
                console.log('ZOE Clash: founder/president em cache — founder =', founder, '| president =', president);
            } else {
                if (statusEl) statusEl.textContent = t('extractingFederationData');
                try {
                    const detailUrl = 'https://www.managerzone.com/?p=federations&id=' + ourId + '&changesport=' + sport + '&_nocache=' + Date.now();
                    console.log('ZOE Clash: a buscar detalhes da federação de:', detailUrl);
                    const detailHtml = await new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: 'GET',
                            url: detailUrl,
                            onload: (r) => { console.log('ZOE Clash: detalhes da fed', ourId, '— tamanho HTML:', r.responseText.length); resolve(r.responseText); },
                            onerror: () => reject(),
                            ontimeout: () => reject()
                        });
                    });
                    const fedUsers = extractFederationUsernames(detailHtml);
                    founder = fedUsers.length > 0 ? fedUsers[0] : '';
                    president = fedUsers.length > 1 ? fedUsers[1] : '';
                    console.log('ZOE Clash: detalhes da federação extraidos — founder =', founder, '| president =', president);
                    if (founder && president) {
                        GM_setValue(founderKey, founder);
                        GM_setValue(presKey, president);
                        console.log('ZOE Clash: founder/president guardados em cache');
                    }
                } catch(e) {
                    console.error('ZOE Clash: erro ao buscar detalhes da federação:', e.message);
                }
            }
            const currentUser = detectCurrentUser();
            console.log('ZOE Clash: postFederationData — fedId =', ourId, '| founder =', founder, '| president =', president, '| sport =', sport, '| currentUser =', currentUser);
            await postFederationData(ourId, founder, president, sport, currentUser || '');

            if (statusEl) statusEl.textContent = t('checkingPermissions');
            const currentUser2 = detectCurrentUser();
            if (!currentUser2) {
                flowOutcome = 'error-no-username';
                flowError = 'Username não detetado';
                if (statusEl) statusEl.innerHTML = '<span style="color:#f44336;font-weight:bold">' + t('errorNoUsername') + '</span>';
                return;
            }
            const data = await fetchAuthorizedUsersFromWebApp(sport, ourId);
            const authorizedUsers = data.users || [];
            const blacklist = data.blacklist || [];
            console.log('ZOE Clash: usernames para fed', ourId, ':', authorizedUsers, '| blacklist:', blacklist);
            if (blacklist.includes(currentUser2.toLowerCase())) {
                console.warn('ZOE Clash: [' + currentUser2 + '] está na blacklist mas a verificação de permissões está desativada — a continuar');
            }
            if (!authorizedUsers.includes(currentUser2.toLowerCase())) {
                console.warn('ZOE Clash: [' + currentUser2 + '] não está na lista de autorizados mas a verificação de permissões está desativada — a continuar');
            }
            console.log('ZOE Clash: utilizador autorizado:', currentUser2);
        }
        let rivalId = scheduleData && scheduleData.rivalId ? scheduleData.rivalId : null;
        let rivalName = scheduleData && scheduleData.rivalName ? scheduleData.rivalName : '';
        if (flowLogContext) flowLogContext.rivalId = rivalId || null;
        if (!rivalId && ourId) {
            if (statusEl) statusEl.textContent = t('detectingRival');
            console.log('ZOE Clash: sem rivalId do calendário, a buscar rival específico da jornada #' + (scheduleData ? scheduleData.round : '?'));

            // Se não tiver cid do scheduleData, tentar obter da página de league
            let cid = scheduleData && scheduleData.cid ? scheduleData.cid : null;
            if (!cid) {
                console.log('ZOE Clash: sem cid no scheduleData, a tentar obter da página de league');
                const leagueUrl = 'https://www.managerzone.com/?p=federations&sub=league&changesport=' + sport + '&fid=' + ourId + '&_nocache=' + Date.now();
                console.log('ZOE Clash: a buscar página de league:', leagueUrl);
                const leagueHtml = await new Promise((resolve) => {
                    GM_xmlhttpRequest({
                        method: 'GET', url: leagueUrl, timeout: 15000,
                        onload: (r) => resolve(r.responseText || ''),
                        onerror: () => resolve(''), ontimeout: () => resolve('')
                    });
                });
                console.log('ZOE Clash: league HTML length =', leagueHtml ? leagueHtml.length : 0);
                if (leagueHtml && leagueHtml.length > 1000) {
                    // Primeiro, mostrar amostra do HTML para entender o formato
                    console.log('ZOE Clash: amostra do HTML da league (primeiros 1000 chars):', leagueHtml.substring(0, 1000));

                    // Procurar pelo round específico no HTML - tentar diferentes formatos
                    const roundLabel = 'Jornada ' + (scheduleData ? scheduleData.round : 1);
                    const roundIdx = leagueHtml.indexOf(roundLabel);
                    console.log('ZOE Clash: a procurar roundLabel =', roundLabel, 'encontrado em índice =', roundIdx);

                    // Se não encontrar o formato simples, tentar encontrar qualquer "Jornada X"
                    let contextStart = roundIdx;
                    if (roundIdx < 0) {
                        const simpleRegex = /Jornada\s+\d+/i;
                        const simpleMatch = leagueHtml.match(simpleRegex);
                        if (simpleMatch) {
                            contextStart = simpleMatch.index;
                            console.log('ZOE Clash: round encontrado com formato simples em índice =', contextStart, ':', simpleMatch[0]);
                        }
                    }

                    // Se ainda não encontrar, tentar com diferentes formatos de data
                    if (contextStart < 0) {
                        const dateFormats = [
                            /Jornada\s+\d+\s*-\s*\d{1,2}-\d{1,2}-\d{4}/i,
                            /Jornada\s+\d+\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}/i,
                            /Jornada\s+\d+\s*-\s*\w+\s+\d{1,2}\s*,\s*\d{4}/i
                        ];
                        for (const df of dateFormats) {
                            const match = leagueHtml.match(df);
                            if (match) {
                                contextStart = match.index;
                                console.log('ZOE Clash: round encontrado com formato de data em índice =', contextStart, ':', match[0]);
                                break;
                            }
                        }
                    }

                    if (contextStart >= 0) {
                        const context = leagueHtml.substring(contextStart, contextStart + 2000);
                        console.log('ZOE Clash: contexto do round (primeiros 500 chars):', context.substring(0, 500));
                        const cidMatch = context.match(/sub=clash[&?]cid=(\d+)/);
                        if (cidMatch) {
                            cid = cidMatch[1];
                            console.log('ZOE Clash: cid obtido da página de league para jornada #' + (scheduleData ? scheduleData.round : 1) + ':', cid);
                        } else {
                            console.log('ZOE Clash: cid não encontrado no contexto do round');
                        }
                    } else {
                        console.log('ZOE Clash: roundLabel não encontrado no HTML da league');
                    }
                } else {
                    console.log('ZOE Clash: HTML da league vazio ou muito pequeno');
                }
            }

            if (cid) {
                // Buscar a página específica do clash para esta jornada
                const clashUrl = 'https://www.managerzone.com/?p=federations&sub=clash&cid=' + cid + '&changesport=' + sport + '&_nocache=' + Date.now();
                console.log('ZOE Clash: a buscar clash específico da jornada:', clashUrl);
                const clashHtml = await new Promise((resolve) => {
                    GM_xmlhttpRequest({
                        method: 'GET', url: clashUrl, timeout: 15000,
                        headers: { 'Referer': 'https://www.managerzone.com/?p=federations&sub=clash&changesport=' + sport },
                        onload: (r) => resolve(r.responseText || ''),
                        onerror: () => resolve(''), ontimeout: () => resolve('')
                    });
                });
                console.log('ZOE Clash: clash HTML length =', clashHtml ? clashHtml.length : 0);
                if (clashHtml && clashHtml.length > 200) {
                    const rival = extractRivalFedId(ourId, clashHtml);
                    if (rival) {
                        rivalId = rival;
                        console.log('ZOE Clash: rival obtido da página específica do Clash (cid=' + cid + ') =', rivalId);
                    } else {
                        console.log('ZOE Clash: não foi possível extrair rival do HTML do clash específico');
                    }
                } else {
                    console.log('ZOE Clash: HTML do clash específico vazio ou muito pequeno');
                }
            } else {
                console.log('ZOE Clash: não foi possível obter cid para a jornada específica');
            }
        }

        // Se ainda não tiver rivalId, tentar buscar da página geral do Clash
        if (!rivalId) {
            console.log('ZOE Clash: a tentar obter rival da página geral do Clash');
            const clashUrl = 'https://www.managerzone.com/?p=federations&sub=clash&changesport=' + sport + '&_nocache=' + Date.now();
            const clashHtml = await new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET', url: clashUrl, timeout: 15000,
                    headers: { 'Referer': 'https://www.managerzone.com/?p=federations&sub=clash&changesport=' + sport },
                    onload: (r) => resolve(r.responseText || ''),
                    onerror: () => resolve(''), ontimeout: () => resolve('')
                });
            });
            if (clashHtml && clashHtml.length > 200) {
                const rival = extractRivalFedId(ourId, clashHtml);
                if (rival) {
                    rivalId = rival;
                    console.log('ZOE Clash: rival obtido da página geral do Clash =', rivalId);
                }
            }
        }

        console.log('ZOE Clash: rivalId =', rivalId, '| rivalName =', rivalName);
        if (flowLogContext) flowLogContext.rivalId = rivalId || null;
        if (!rivalId) {
            flowOutcome = 'error-no-rival';
            flowError = 'Rival não detetado';
            if (statusEl) statusEl.innerHTML = '<span style="color:#f44336;font-weight:bold">' + t('errorNoFederation') + '</span>';
            return;
        }
        if (statusEl) statusEl.textContent = t('fetchingClashData');
        const clashSettings = getClashSettings(sport);
        if (clashSettings.autoChineseSwitch && !rivalName) {
            const rivalLinks = document.querySelectorAll('.clash-standings .fed_link');
            for (const link of rivalLinks) {
                const m = link.href.match(/fid=(\d+)/);
                if (m && m[1] === rivalId) { rivalName = link.textContent.trim(); break; }
            }
        }
        if (clashSettings.autoChineseSwitch && rivalName && /[\u4e00-\u9fff]/.test(rivalName)) {
            console.log('ZOE Clash: rival chinês detetado ("' + rivalName + '"), a mudar para Mostrar: Usuários');
            clashSettings.showUsers = true;
        }
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        console.log('ZOE Clash: desporto detectado =', sport, '| URL =', window.location.href);
        const apiUrl = 'https://statsxente.com/MZ1/Functions/loadClashMatcher.php?fid=' + ourId + '&fid1=' + rivalId + '&idioma=PORTUGUES&divisa=EUR&sport=' + sport + '&type=' + clashSettings.clashType + '&start_date=' + thirtyDaysAgo + '&final_date=' + now + '&limit=3&teams_offered=' + (clashSettings.clashType === 'offer' ? clashSettings.teamsOffered : 0);
        console.log('ZOE Clash: API URL =', apiUrl);
        logTiming('antesAPI');
        let tableHtml;
        try {
            tableHtml = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: apiUrl,
                    onload: (r) => { console.log('ZOE Clash: API response length =', r.responseText.length); resolve(r.responseText); },
                    onerror: (e) => reject(new Error('Erro na API statsxente')),
                    ontimeout: () => reject(new Error('Timeout na API statsxente'))
                });
            });
        } catch(e) {
            flowOutcome = 'error-api';
            flowError = e.message;
            console.error('ZOE Clash: erro ao buscar dados:', e.message);
            if (statusEl) statusEl.innerHTML = '<span style="color:#f44336">Erro: ' + e.message + '</span>';
            return;
        }
        if (!tableHtml || tableHtml.trim().length === 0) {
            flowOutcome = 'error-empty-api';
            flowError = 'Resposta vazia do statsxente';
            console.error('ZOE Clash: resposta vazia da API');
            if (statusEl) statusEl.innerHTML = '<span style="color:#f44336">Resposta vazia do statsxente.</span>';
            return;
        }
        if (tableHtml.trim().length < 500 || !/<tr[\s>]/i.test(tableHtml) || (tableHtml.match(/<tr[\s>]/gi) || []).length < 3) {
            console.error('ZOE Clash: API sem dados de jogos, length =', tableHtml.trim().length);
            const storedIds = getFedIdStorage();
            const info = '<br><br><span style="font-size:11px;color:#aaa">IDs guardados — Futebol: <b style="color:#e94560">' + (storedIds.soccer || 'nenhum') + '</b> | Hoquei: <b style="color:#e94560">' + (storedIds.hockey || 'nenhum') + '</b></span>';
            // FALLBACK: determinar ourId/rival pela interseção das tabelas #standings (prev=1 ∩ atual).
            // Se houver um fid em comum (match), prosseguir com a lógica normal usando os IDs corrigidos;
            // caso contrário, manter o erro.
            let fb = null;
            try { fb = await resolveOurFedIdViaStandings(sport); }
            catch (fbe) { console.error('ZOE Clash: erro no fallback standings:', fbe.message); }
            if (fb && fb.ourId && fb.rivalId) {
                ourId = fb.ourId;
                saveOurFedId(ourId);
                console.log('ZOE Clash: fallback match — ourId corrigido =', ourId);
                rivalId = fb.rivalId;
                console.log('ZOE Clash: fallback match — rivalId =', rivalId);
                if (statusEl) statusEl.textContent = 'Fallback: IDs corrigidos (ourId=' + ourId + ', rivalId=' + rivalId + '), a gerar imagem...';
                const apiUrl2 = 'https://statsxente.com/MZ1/Functions/loadClashMatcher.php?fid=' + ourId + '&fid1=' + rivalId + '&idioma=PORTUGUES&divisa=EUR&sport=' + sport + '&type=' + clashSettings.clashType + '&start_date=' + thirtyDaysAgo + '&final_date=' + now + '&limit=3&teams_offered=' + (clashSettings.clashType === 'offer' ? clashSettings.teamsOffered : 0);
                console.log('ZOE Clash: fallback match — nova API URL =', apiUrl2);
                try {
                    const tableHtml2 = await new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: 'GET', url: apiUrl2,
                            onload: (r) => { console.log('ZOE Clash: fallback API response length =', r.responseText.length); resolve(r.responseText); },
                            onerror: (e) => reject(new Error('Erro na API statsxente')),
                            ontimeout: () => reject(new Error('Timeout na API statsxente'))
                        });
                    });
                    const valid = tableHtml2 && tableHtml2.trim().length >= 500 && /<tr[\s>]/i.test(tableHtml2) && (tableHtml2.match(/<tr[\s>]/gi) || []).length >= 3;
                    if (valid) {
                        tableHtml = tableHtml2;
                        if (statusEl) statusEl.textContent = t('generatingImage');
                        logTiming('fallbackDadosAPI');
                        // continuar para a geração de imagem/upload/publicação abaixo (sem return)
                    } else {
                        flowOutcome = 'error-no-games';
                        flowError = 'Fallback API sem jogos';
                        console.log('ZOE Clash: fallback match mas a API continua sem jogos — manter erro');
                        if (statusEl) statusEl.innerHTML = '<span style="color:#f44336">' + t('noGamesFound') + '</span>' + info;
                        return;
                    }
                } catch(e) {
                    flowOutcome = 'error-api-fallback';
                    flowError = e.message;
                    console.error('ZOE Clash: erro no fallback API:', e.message);
                    if (statusEl) statusEl.innerHTML = '<span style="color:#f44336">' + t('noGamesFound') + '</span>' + info;
                    return;
                }
            } else {
                flowOutcome = 'error-no-games';
                flowError = 'Sem jogos (sem match no fallback)';
                console.log('ZOE Clash: fallback — sem match entre prev=1 e atual — manter erro');
                if (statusEl) statusEl.innerHTML = '<span style="color:#f44336">' + t('noGamesFound') + '</span>' + info;
                return;
            }
        }
        if (statusEl) statusEl.textContent = t('generatingImage');
        logTiming('dadosAPI');
                console.log('ZOE Clash: a preparar screenshot do HTML do statsxente');
        const usePlainImage = /\*image\*/.test(clashSettings.guestbookTemplate || '');
        const useStatsImage = /\*image_stats\*/.test(clashSettings.guestbookTemplate || '');
        let statsData = null;
        if (useStatsImage) {
            try {
                let rivalFedName = rivalName || 'Rival';
                const ourTeams = extractClashTeamData(tableHtml);
                let ourPdD = null;
                let rivalPdD = null;
                try {
                    const divParts = scheduleData && scheduleData.division ? scheduleData.division.split('.') : [];
                    const lev = (scheduleData && scheduleData.lev) ? scheduleData.lev : (divParts[0] || null);
                    const dvi = (scheduleData && scheduleData.dvi) ? scheduleData.dvi : (divParts[1] || null);
                    const divHtml = await fetchDivisionTable(sport, lev, dvi);
                    ourPdD = extractPdDFromDivision(divHtml, ourId);
                    rivalPdD = extractPdDFromDivision(divHtml, rivalId);
                } catch(e) { console.warn('ZOE Clash: PdD não disponível:', e.message); }
                statsData = calculateCombinedScore(ourTeams, [{ elo: 1500, lmv: 5 }], ourPdD || 150, rivalPdD || 150);
                statsData.rivalName = rivalFedName;
                console.log('ZOE Clash: stats calculados — prob:', statsData.probability + '%, diff:', statsData.difficulty);
            } catch(e) { console.warn('ZOE Clash: erro ao gerar stats:', e.message); }
        }
        const doc = unsafeWindow.document;
        const container = doc.createElement('div');
        const sizeMap = { small: 500, normal: 700, large: 900, xlarge: 1200, xxlarge: 1500 };
        const containerWidth = sizeMap[clashSettings.imgSize] || 700;
        container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:' + containerWidth + 'px;z-index:99999;background:#fff';
        container.innerHTML = '<link href="https://fonts.googleapis.com/css?family=Roboto&family=Righteous&family=Sintony&display=swap" rel="stylesheet"><div style="padding:10px"><h3 style="margin:0 0 8px;color:#333;font-family:Arial,sans-serif">Clash Matcher: ' + ourId + ' vs ' + rivalId + '</h3>' + tableHtml + '</div>';
                container.querySelectorAll('script').forEach(el => el.remove());
        doc.body.appendChild(container);
        container.querySelectorAll('meta[http-equiv="refresh"]').forEach(el => el.remove());
        const flagImgs = container.querySelectorAll('img');
        const flagPromises = [];
        flagImgs.forEach(img => {
            const src = img.getAttribute('src');
            if (src && src.startsWith('../')) {
                const absUrl = 'https://statsxente.com/MZ1/' + src.substring(3);
                flagPromises.push(new Promise(resolve => {
                    GM_xmlhttpRequest({
                        method: 'GET', url: absUrl, responseType: 'arraybuffer',
                        onload: (r) => {
                            if (r.status === 200 && r.response && r.response.byteLength > 0) {
                                const bytes = new Uint8Array(r.response);
                                let binary = '';
                                for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                                img.src = 'data:image/png;base64,' + unsafeWindow.btoa(binary);
                            }
                            resolve();
                        },
                        onerror: () => resolve(), ontimeout: () => resolve()
                    });
                }));
            }
        });
        await Promise.all(flagPromises);
        if (clashSettings.showUsers) {
            container.querySelectorAll('.user_team, .user_rival').forEach(el => { el.style.display = ''; });
            container.querySelectorAll('.name_team, .name_rival').forEach(el => { el.style.display = 'none'; });
        }
        const table = container.querySelector('table');
        if (table) {
            table.style.setProperty('width', clashSettings.tableWidth + '%', 'important');
            const hideCols = [];
            if (!clashSettings.showTeams) { hideCols.push(0,1,2,3,4); }
            if (!clashSettings.showElo) { hideCols.push(5,6,7); }
            if (!clashSettings.showLmv) { hideCols.push(8,9); }
            if (!clashSettings.showStats) { hideCols.push(10,11); }
            console.log('ZOE Clash: hideCols =', JSON.stringify(hideCols), '| table class:', table.className);
            const allTrs = table.querySelectorAll('tr');
            allTrs.forEach((tr, trIdx) => {
                if (tr.classList.contains('zoe-stats-header')) { console.log('ZOE Clash: row ' + trIdx + ' = stats-header (skipped)'); return; }
                const cells = tr.querySelectorAll('th, td');
                console.log('ZOE Clash: row ' + trIdx + ' cells=' + cells.length + ' tag=' + (cells[0] ? cells[0].tagName : '?'));
                cells.forEach((cell, i) => { if (hideCols.includes(i)) cell.style.display = 'none'; });
            });
        }
                console.log('ZOE Clash: container com HTML statsxente appendado');
        try {
            try { await doc.fonts.ready; } catch(e) {}
            const imgs = container.querySelectorAll('img');
            await Promise.all([...imgs].map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })));
            const target = container.querySelector('.show444') || container.querySelector('table') || container;
            const elemW = target.offsetWidth;
            const elemH = target.offsetHeight;
            console.log('ZOE Clash: tableWidth=' + clashSettings.tableWidth + '% imgSize=' + clashSettings.imgSize + ' containerWidth=' + containerWidth, 'target =', target.tagName, 'offset =', elemW, 'x', elemH);
            let imgUrlPlain = null;
            let imgUrlStats = null;
            if (usePlainImage) {
                console.log('ZOE Clash: a gerar imagem SEM stats header');
                const canvasPlain = await html2canvas(target, { backgroundColor: '#ffffff', scale: clashSettings.imgScale || 1, logging: false, useCORS: true });
                console.log('ZOE Clash: canvas plain pronto =', canvasPlain.width, 'x', canvasPlain.height);
                const dataUrlPlain = canvasPlain.toDataURL('image/png');
                const b64Plain = dataUrlPlain.split(',')[1];
                const binPlain = atob(b64Plain);
                const arrPlain = new Uint8Array(binPlain.length);
                for (let i = 0; i < binPlain.length; i++) arrPlain[i] = binPlain.charCodeAt(i);
                const blobPlain = new Blob([arrPlain], { type: 'image/png' });
                if (!blobPlain || blobPlain.size < 100) throw new Error('Imagem demasiado pequena (' + blobPlain.size + ' bytes)');
                if (canvasPlain.height < 50) throw new Error('Tabela demasiado pequena (' + canvasPlain.width + 'x' + canvasPlain.height + ') - nenhum jogo encontrado');
                const clashFileNamePlain = buildClashFileName(clashSettings);
                imgUrlPlain = await uploadImage(blobPlain, clashSettings.imgExpiration, clashFileNamePlain);
                flowImageGenerated = true;
                flowImageUrls.plain = imgUrlPlain;
                console.log('ZOE Clash: upload plain concluido =', imgUrlPlain);
                logTiming('screenshotPlain');
                if (!autoRun) {
                    const img = doc.createElement('img');
                    img.src = dataUrlPlain;
                    img.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:999999;max-width:90vw;max-height:90vh;border:3px solid #fff;background:#000';
                    doc.body.appendChild(img);
                    const overlay = doc.createElement('div');
                    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:999998';
                    overlay.onclick = () => { img.remove(); overlay.remove(); };
                    doc.body.appendChild(overlay);
                    console.log('ZOE Clash: imagem mostrada no ecra (clicar para fechar)');
                }
            }
            if (useStatsImage && statsData) {
                const mainTable = container.querySelector('table.show444') || container.querySelector('table');
                if (mainTable) {
                    const headerHtml = generateStatsHeaderHTML(statsData.rivalName, statsData, clashSettings);
                    const thead = mainTable.querySelector('thead');
                    if (thead) {
                        thead.insertAdjacentHTML('afterbegin', headerHtml);
                        console.log('ZOE Clash: stats <tr> inserido no <thead>');
                    } else {
                        const firstTr = mainTable.querySelector('tr');
                        if (firstTr) firstTr.insertAdjacentHTML('beforebegin', headerHtml);
                        console.log('ZOE Clash: stats <tr> inserido antes do primeiro <tr>');
                    }
                }
                console.log('ZOE Clash: a gerar imagem COM stats header');
                const canvasStats = await html2canvas(target, { backgroundColor: '#ffffff', scale: clashSettings.imgScale || 1, logging: false, useCORS: true });
                console.log('ZOE Clash: canvas stats pronto =', canvasStats.width, 'x', canvasStats.height);
                const dataUrlStats = canvasStats.toDataURL('image/png');
                const b64Stats = dataUrlStats.split(',')[1];
                const binStats = atob(b64Stats);
                const arrStats = new Uint8Array(binStats.length);
                for (let i = 0; i < binStats.length; i++) arrStats[i] = binStats.charCodeAt(i);
                const blobStats = new Blob([arrStats], { type: 'image/png' });
                if (!blobStats || blobStats.size < 100) throw new Error('Imagem stats demasiado pequena (' + blobStats.size + ' bytes)');
                if (canvasStats.height < 50) throw new Error('Tabela stats demasiado pequena (' + canvasStats.width + 'x' + canvasStats.height + ')');
                const clashFileNameStats = buildClashFileName(clashSettings).replace('.png', '_stats.png');
                imgUrlStats = await uploadImage(blobStats, clashSettings.imgExpiration, clashFileNameStats);
                flowImageGenerated = true;
                flowImageUrls.stats = imgUrlStats;
                console.log('ZOE Clash: upload stats concluido =', imgUrlStats);
                logTiming('screenshotStats');
            }
            if (statusEl) statusEl.textContent = t('imageGenerated');
            flowLogContext = { sport: sport, ourId: ourId, rivalId: rivalId, autoRun: !!autoRun, pageInfo: null, trigger: autoRun ? 'auto' : 'manual' };
            const clashSettings2 = getClashSettings(sport);
            let pageInfo = null;
            if (clashSettings2.guestbookTemplate && clashSettings2.guestbookTemplate.trim()) {
                if (clashSettings2.askBeforePost && !autoRun) {
                    const confirmed = await showConfirmDialog(t('confirmSendToBoard'), true);
                    if (!confirmed) {
                        flowOutcome = 'cancelled-guestbook';
                        console.log('ZOE Clash: utilizador cancelou envio para guestbook');
                        return;
                    }
                }
                                pageInfo = scheduleData ? { round: String(scheduleData.round), season: scheduleData.season || '', division: scheduleData.division || '', rival: scheduleData.rivalName || '' } : extractClashPageInfo();
                if (flowLogContext && pageInfo) flowLogContext.pageInfo = { round: pageInfo.round, season: pageInfo.season, division: pageInfo.division, rival: pageInfo.rival };
                const hasImagePlaceholder = /\*image\*/.test(clashSettings2.guestbookTemplate);
                const hasImageStats = /\*image_stats\*/.test(clashSettings2.guestbookTemplate);
                const eloRows = parseClashMatchupTable(tableHtml);
                const eloBlock = buildEloBlock(tableHtml);
                if (eloBlock) console.log('ZOE Clash: bloco ELO/LMV gerado para ' + eloRows.length + ' confrontos');
                const msg = buildGuestbookMessage(clashSettings2.guestbookTemplate, pageInfo, (hasImagePlaceholder && imgUrlPlain) ? imgUrlPlain : null, eloBlock, eloRows, false, (hasImageStats && imgUrlStats) ? imgUrlStats : null);
                console.log('ZOE Clash: guestbook message =', msg);
                const postedOk = await postToGuestbook(msg, sport, clashSettings2.boardType, ourId);
                flowGuestbookPosted = postedOk;
                logTiming('postGuestbook');
                console.log('ZOE Clash: gate do chat | postedOk=' + postedOk + ' | chatToManagers=' + !!clashSettings2.chatToManagers + ' | templateLen=' + String(clashSettings2.chatTemplate || '').length + ' | autoRun=' + !!autoRun + ' | visibility=' + document.visibilityState);
                if (postedOk && clashSettings2.chatToManagers && clashSettings2.chatTemplate && clashSettings2.chatTemplate.trim()) {
                    console.log('ZOE Clash: imagem postada com sucesso, a enviar mensagens do chat aos managers...');
                    flowChatResult = (await executeChatSend(sport, pageInfo, eloRows, ourId)) || { status: 'unknown' };
                    logTiming('postChat');
                } else if (!postedOk) {
                    flowChatResult = { status: 'guestbook-failed' };
                    console.log('ZOE Chat: imagem não postada, sem envio de mensagens do chat | postedOk=' + postedOk + ' | chatToManagers=' + !!clashSettings2.chatToManagers + ' | templateLen=' + String(clashSettings2.chatTemplate || '').length);
                } else {
                    flowChatResult = { status: 'disabled' };
                    console.log('ZOE Chat: desativado no fluxo | chatToManagers=' + !!clashSettings2.chatToManagers + ' | templateLen=' + String(clashSettings2.chatTemplate || '').length);
                }
            }
            if (autoRun) {
                console.log('ZOE AutoRun: fluxo completo, a reagendar...');
                const usedRound = scheduleData ? scheduleData.round : (pageInfo && pageInfo.round ? parseInt(pageInfo.round) : null);
                await scheduleAutoRun(sport, usedRound);
                logTiming('total');
            }
            flowOutcome = 'completed';
        } catch(e) {
            flowOutcome = 'error';
            flowError = e.message;
            console.error('ZOE Clash: erro ao gerar/upload imagem:', e.message);
            if (statusEl) statusEl.innerHTML = '<span style="color:#f44336">Erro imagem: ' + e.message + '</span>';
        } finally {
            container.remove();
        }
    } finally {
        setPageLock(false);
        if (autoRun) releaseRunLock();
        startClashScreenshotFlow._running = false;
        startClashScreenshotFlow._cooldownUntil = Date.now() + 3000;
        try {
            if (!flowLogContext) {
                flowLogContext = { sport: detectCurrentSport(), ourId: null, rivalId: null, autoRun: !!autoRun, pageInfo: null, trigger: autoRun ? 'auto' : 'manual' };
            }
            const shouldLogFlow = flowLogContext.trigger === 'manual' ||
                (flowImageGenerated && getClashSettings(flowLogContext.sport).sendDiagnosticLogs);
            if (shouldLogFlow) {
                const entries = zoeLogBuffer.filter(entry => entry.seq > flowLogStartSeq);
                void sendClashDiagnosticLog({
                    version: SCRIPT_VERSION,
                    timestamp: new Date().toISOString(),
                    username: detectCurrentUser() || '',
                    sport: flowLogContext.sport,
                    ourId: flowLogContext.ourId,
                    rivalId: flowLogContext.rivalId,
                    autoRun: flowLogContext.autoRun,
                    trigger: flowLogContext.trigger || (autoRun ? 'auto' : 'manual'),
                    outcome: flowOutcome,
                    pageInfo: flowLogContext.pageInfo,
                    language: getLanguage(),
                    image: {
                        generated: flowImageGenerated,
                        plain: !!flowImageUrls.plain,
                        stats: !!flowImageUrls.stats,
                        urlPlain: flowImageUrls.plain || null,
                        urlStats: flowImageUrls.stats || null
                    },
                    guestbookPosted: flowGuestbookPosted,
                    chat: flowChatResult,
                    error: flowError,
                    durationMs: Date.now() - flowStartedAt,
                    timings: flowTimings,
                    userAgent: navigator.userAgent,
                    pageUrl: location.href,
                    entries: entries
                });
            }
        } catch(e) {
            console.warn('ZOE Log: erro ao preparar diagnóstico:', e.message);
        }
    }
    }

    // --- Clash UI ---

    function getChatTestTarget() {
        const current = (typeof detectCurrentUser === 'function' ? detectCurrentUser() : '') || '';
        const isMarl = current.trim().toLowerCase() === 'marl_man_boro';
        return isMarl ? { uid: '6921358', name: 'ruisimoes' } : { uid: '1313869', name: 'marl_man_boro' };
    }

    function injectClashIcon() {
        if (!window.location.search.includes('sub=clash')) return;
        function tryInject() {
            if (document.getElementById('zoe-clash-icon')) return;
            const deadline = document.querySelector('.top-pane__deadline');
            if (!deadline) return false;
            const icon = document.createElement('span');
            icon.id = 'zoe-clash-icon';
            icon.textContent = '📷';
            icon.title = 'Gerar imagem do Clash';
            icon.style.cssText = 'cursor:pointer;font-size:18px;margin:0 3px;filter:grayscale(100%);transition:filter 0.2s';
            icon.onmouseenter = () => icon.style.filter = 'grayscale(0%)';
            icon.onmouseleave = () => icon.style.filter = 'grayscale(100%)';
            icon.onclick = () => startClashScreenshotFlow();
            const gear = document.createElement('span');
            gear.textContent = '⚙';
            gear.title = 'Config Clash';
            const sport = detectCurrentSport();
            const cfg = getClashConfig(sport);
            const needsRed = cfg && cfg.guestbookTemplate && cfg.guestbookTemplate.trim() && !/\*image\*/.test(cfg.guestbookTemplate);
            gear.style.cssText = 'cursor:pointer;font-size:16px;margin:0 3px;filter:grayscale(100%);transition:filter 0.2s' + (needsRed ? ';color:#f44336;filter:none' : '');
            gear.onmouseenter = () => { gear.style.filter = 'none'; };
            gear.onmouseleave = () => { gear.style.filter = needsRed ? 'none' : 'grayscale(100%)'; };
            gear.onclick = (e) => { e.stopPropagation(); showClashSettings(sport); };
            const testBtn = document.createElement('span');
            testBtn.id = 'zoe-chat-test-icon';
            testBtn.textContent = '💬';
            const testTarget = getChatTestTarget();
            testBtn.title = 'Teste Chat (temporário) — envia "Teste Chat" para ' + testTarget.name + ' (uid ' + testTarget.uid + ')';
            testBtn.style.cssText = 'cursor:pointer;font-size:16px;margin:0 3px;filter:grayscale(100%);transition:filter 0.2s';
            testBtn.onmouseenter = () => { testBtn.style.filter = 'none'; };
            testBtn.onmouseleave = () => { testBtn.style.filter = 'grayscale(100%)'; };
            testBtn.onclick = (e) => { e.stopPropagation(); runSingleChatTest(); };
            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'text-align:center;margin-top:2px';
            btnRow.appendChild(icon);
            btnRow.appendChild(gear);
            btnRow.appendChild(testBtn);
            const firstBr = deadline.querySelector('br');
            if (firstBr) {
                firstBr.after(btnRow);
            } else {
                deadline.appendChild(btnRow);
            }
            window._zoeClashGear = gear;
            return true;
        }
        if (!tryInject()) {
            let attempts = 0;
            const timer = setInterval(() => {
                attempts++;
                if (tryInject() || attempts > 40) clearInterval(timer);
            }, 500);
        }
    }

    function updateClashGearColor(sport, cfg) {
        const gear = window._zoeClashGear;
        if (!gear) return;
        const needsRed = cfg && cfg.guestbookTemplate && cfg.guestbookTemplate.trim() && !/\*image\*/.test(cfg.guestbookTemplate);
        if (needsRed) {
            gear.style.color = '#f44336';
            gear.style.filter = 'none';
        } else {
            gear.style.color = '';
            gear.style.filter = 'grayscale(100%)';
        }
    }

    async function testClashScreenshot(sport, cfg) {
        const overlay = document.createElement('div');
        overlay.id = 'zoe-test-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000004;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center';
        const statusEl = document.createElement('div');
        statusEl.id = 'zoe-test-status';
        statusEl.style.cssText = 'position:relative;z-index:10000005;padding:10px 20px;background:#1a1a2e;color:#eee;border:2px solid #ff9800;border-radius:8px;font-family:Arial,sans-serif;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.5);width:50%;max-width:90%;min-width:280px;max-height:90vh;overflow-y:auto;text-align:center';
        statusEl.textContent = '[PRÉ-VIZUALIZAÇÃO] A detetar federações...';
        overlay.appendChild(statusEl);
        document.body.appendChild(overlay);
        const t0 = performance.now();
        const logTiming = (label) => { console.log('ZOE TIMING PRÉ-VIZUALIZAÇÃO: ' + label + ' — ' + (performance.now() - t0).toFixed(0) + 'ms'); };
        const ourId = await fetchOurFedId();
        if (!ourId) { statusEl.textContent = '[PRÉ-VIZUALIZAÇÃO] Erro: Federação não encontrada'; return; }
        const scheduleData = await fetchNextRoundData(sport);
        if (!scheduleData) { statusEl.textContent = '[PRÉ-VIZUALIZAÇÃO] Erro: Calendário não disponível'; return; }
        const rivalId = scheduleData.rivalId;
        if (!rivalId) { statusEl.textContent = '[PRÉ-VIZUALIZAÇÃO] Erro: Rival não detetado'; return; }
        statusEl.textContent = '[PRÉ-VIZUALIZAÇÃO] A buscar dados do Clash...';
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        const apiUrl = 'https://statsxente.com/MZ1/Functions/loadClashMatcher.php?fid=' + ourId + '&fid1=' + rivalId + '&idioma=PORTUGUES&divisa=EUR&sport=' + sport + '&type=' + cfg.clashType + '&start_date=' + thirtyDaysAgo + '&final_date=' + now + '&limit=3&teams_offered=' + (cfg.clashType === 'offer' ? cfg.teamsOffered : 0);
        let tableHtml;
        try {
            tableHtml = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({ method: 'GET', url: apiUrl, timeout: 15000, onload: (r) => resolve(r.responseText || ''), onerror: () => reject(), ontimeout: () => reject() });
            });
        } catch(e) { statusEl.textContent = '[PRÉ-VIZUALIZAÇÃO] Erro na API statsxente: ' + e.message; return; }
        logTiming('API statsxente');
        const eloRows = parseClashMatchupTable(tableHtml);
        const pageInfo = { round: String(scheduleData.round), season: scheduleData.season || '', division: scheduleData.division || '', rival: scheduleData.rivalName || '', tableHtml };
        statusEl.textContent = '[PRÉ-VIZUALIZAÇÃO] A gerar imagem do Clash...';
        const result = await renderClashImageHTML(sport, pageInfo, eloRows, ourId, cfg);
logTiming('Imagem gerada');
                const imgUrl = 'data:image/png;base64,' + result.canvas.toDataURL('image/png').split(',')[1];
        const hasImagePlaceholder = /\*image\*/.test(cfg.guestbookTemplate) || /\*image_stats\*/.test(cfg.guestbookTemplate);
        const hasStatsPlaceholder = /\*elo\*/.test(cfg.guestbookTemplate) || /\*image_stats\*/.test(cfg.guestbookTemplate);
        const eloBlock = hasStatsPlaceholder ? buildEloBlock(tableHtml) : '';
        const msg = buildGuestbookMessage(cfg.guestbookTemplate, pageInfo, hasImagePlaceholder ? imgUrl : null, eloBlock, eloRows, true, hasImagePlaceholder ? imgUrl : null);
        let remaining = 30;
        const countdownEl = document.createElement('div');
        countdownEl.style.cssText = 'margin-top:8px;font-size:12px;color:#ffc107;font-family:monospace';
        countdownEl.textContent = 'Fecha em ' + remaining + 's...';
        let displayMsg = msg || '(template vazio)';
        displayMsg = displayMsg.replace(/\[img\](.*?)\[\/img\]/gs, '<img src="$1" style="max-width:100%;height:auto;border:1px solid #4caf50;border-radius:4px;margin:4px 0;display:block">');
        displayMsg = displayMsg.replace(/https?:\/\/[^\s\[<>"]+/g, (url) => {
            if (url.startsWith('data:image')) return 'https://i.ibb.co/fake-preview.png';
            return url;
        });
        const closeEl = document.createElement('span');
        closeEl.textContent = '×';
        closeEl.style.cssText = 'position:absolute;top:4px;right:8px;cursor:pointer;font-size:18px;line-height:1;color:#999';
        closeEl.onclick = () => overlay.remove();
        const msgEl = document.createElement('div');
        msgEl.innerHTML = displayMsg;
        msgEl.style.cssText = 'max-width:calc(100% - 20px);white-space:pre-wrap;word-break:break-word;margin-top:8px;padding:8px;background:#16213e;border:1px solid #555;border-radius:4px;color:#ddd;font-size:11px;font-family:monospace;text-align:left;overflow-x:auto';
        statusEl.style.position = 'relative';
        statusEl.innerHTML = '[PRÉ-VIZUALIZAÇÃO] Pré-visualização da mensagem exata que será postada:';
        statusEl.style.zIndex = '10000000';
        statusEl.appendChild(closeEl);
        statusEl.appendChild(msgEl);
        statusEl.appendChild(countdownEl);
        console.log('[PRÉ-VIZUALIZAÇÃO] Imagem gerada:', result.canvas.width + 'x' + result.canvas.height);
        console.log('[PRÉ-VIZUALIZAÇÃO] Mensagem a postar:', msg);
        const interval = setInterval(() => {
            remaining--;
            if (remaining > 0) {
                countdownEl.textContent = 'Fecha em ' + remaining + 's...';
            } else {
                clearInterval(interval);
                overlay.remove();
            }
        }, 1000);
    }

    async function renderClashImageHTML(sport, pageInfo, eloRows, ourId, cfg) {
        const doc = unsafeWindow.document;
        const sizeMap = { small: 500, normal: 700, large: 900, xlarge: 1200, xxlarge: 1500 };
        const containerWidth = sizeMap[cfg.imgSize] || 700;
        const docu = unsafeWindow.document;
        const container = docu.createElement('div');
        container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:' + containerWidth + 'px;z-index:99999;background:#fff';
        const rivalId = pageInfo.rival ? pageInfo.rival.match(/fid=(\d+)/)?.[1] : '?';
        container.innerHTML = '<link href="https://fonts.googleapis.com/css?family=Roboto&family=Righteous&family=Sintony&display=swap" rel="stylesheet"><div style="padding:10px"><h3 style="margin:0 0 8px;color:#333;font-family:Arial,sans-serif">Clash Matcher: ' + ourId + ' vs ' + rivalId + '</h3>' + pageInfo.tableHtml + '</div>';
        container.querySelectorAll('script').forEach(el => el.remove());
        docu.body.appendChild(container);
        try { await docu.fonts.ready; } catch(e) {}
        const imgs = container.querySelectorAll('img');
        await Promise.all([...imgs].map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })));
        const target = container.querySelector('.show444') || container.querySelector('table') || container;
        if (target) {
            target.style.setProperty('width', cfg.tableWidth + '%', 'important');
            const hideCols = [];
            if (!cfg.showTeams) { hideCols.push(0,1,2,3,4); }
            if (!cfg.showElo) { hideCols.push(5,6,7); }
            if (!cfg.showLmv) { hideCols.push(8,9); }
            if (!cfg.showStats) { hideCols.push(10,11); }
            const allTrs = target.querySelectorAll('tr');
            allTrs.forEach((tr) => {
                const cells = tr.querySelectorAll('th, td');
                cells.forEach((cell, i) => { if (hideCols.includes(i)) cell.style.display = 'none'; });
            });
        }
        const canvas = await html2canvas(target, { backgroundColor: '#ffffff', scale: cfg.imgScale || 1, logging: false, useCORS: true });
        docu.body.removeChild(container);
        return { canvas, html: container.innerHTML };
    }

    function showClashSettings(sport) {
        const old = document.getElementById('zoe-clash-settings');
        if (old) { old.remove(); return; }
        const s = getClashSettings(sport);
        const currentLang = getLanguage();
        const sportLabel = sport === 'soccer' ? t('soccer') : t('hockey');
        const accent = sport === 'soccer' ? '#4caf50' : '#2196f3';
        const doc = unsafeWindow.document;
        const panel = doc.createElement('div');
        panel.id = 'zoe-clash-settings';
        panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999999;background:#1a1a2e;border:2px solid ' + accent + ';border-radius:10px;padding:16px 10px;font-family:Arial,sans-serif;color:#eee;font-size:13px;width:85%;max-width:460px;max-height:90vh;overflow-y:auto;box-shadow:0 4px 24px rgba(0,0,0,0.7)';

        // Gerar opções de idioma com bandeiras para dropdown customizado
        const langDropdownHtml = Object.keys(TRANSLATIONS).map(lang => {
            const flagUrl = `https://flagcdn.com/w20/${TRANSLATIONS[lang].flag}.png`;
            return `<div class="zoe-lang-option" data-lang="${lang}" style="display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;transition:background 0.2s"><img src="${flagUrl}" style="width:20px;height:11px;border-radius:1px;"></div>`;
        }).join('');

        let html = '<style>#zoe-clash-settings input[type=checkbox]{width:16px;height:16px}.zoe-lang-dropdown{display:none;position:absolute;top:100%;right:0;z-index:10;background:#1a1a2e;border:1px solid #555;border-radius:4px;margin-top:4px;box-shadow:0 4px 16px rgba(0,0,0,0.5);animation:fadeIn 0.2s ease}.zoe-lang-option:hover{background:#2a3a5e}@keyframes fadeIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}</style>';
        html += '<div style="display:flex;align-items:center;margin-bottom:12px;position:relative">';
        html += '<div style="display:flex;align-items:center;gap:8px;width:100%;justify-content:center">';
        html += `<b style="font-size:14px;color:${accent}">${t('configClash')} ${sportLabel}</b>`;
        html += '</div>';
        html += '<div style="display:flex;align-items:center;gap:8px;position:absolute;right:0">';
        html += `<div style="position:relative"><div id="zoe-cfg-language" style="cursor:pointer;display:flex;align-items:center;gap:4px;padding:4px 8px;border:1px solid #555;border-radius:4px;background:#16213e;transition:border-color 0.2s"><img id="zoe-lang-current-flag" src="https://flagcdn.com/w20/${TRANSLATIONS[currentLang].flag}.png" style="width:20px;height:11px;border-radius:1px;"><span style="font-size:10px;color:#999">▼</span></div>`;
        html += `<div id="zoe-lang-dropdown" class="zoe-lang-dropdown">${langDropdownHtml}</div>`;
        html += '</div>';
        html += '<span id="zoe-clash-cfg-close" style="cursor:pointer;font-size:16px;color:#999;margin-left:8px">&times;</span>';
        html += '</div></div>';

        html += '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px">';
        html += '<div><div style="font-weight:bold;margin-bottom:6px;color:#ccc">' + t('clashType') + '</div>';
        html += '<select id="zoe-cfg-clashType" style="padding:4px;border:1px solid #555;border-radius:4px;background:#16213e;color:#eee;font-size:12px;width:auto">';
        [
            { value: 'elo', label: t('elo') },
            { value: 'best', label: t('best') },
            { value: 'offer', label: t('offer') }
        ].forEach(o => {
            const selected = s.clashType === o.value ? 'selected' : '';
            html += '<option value="' + o.value + '" ' + selected + '>' + o.label + '</option>';
        });
        html += '</select></div>';
        html += '<div id="zoe-cfg-offer-opts" style="display:' + (s.clashType === 'offer' ? 'block' : 'none') + '"><div style="font-weight:bold;margin-bottom:6px;color:#ccc">' + t('teamsOffered') + '</div>';
        html += '<select id="zoe-cfg-teamsOffered" style="padding:4px;border:1px solid #555;border-radius:4px;background:#16213e;color:#eee;font-size:12px;width:auto">';
        for (let i = 1; i <= 16; i++) {
            const selected = s.teamsOffered === i ? 'selected' : '';
            html += '<option value="' + i + '" ' + selected + '>' + i + '</option>';
        }
        html += '</select></div>';
        html += '<div><div style="font-weight:bold;margin-bottom:6px;color:#ccc">' + t('showUsers') + '</div>';
        html += '<select id="zoe-cfg-showUsers" style="padding:4px;border:1px solid #555;border-radius:4px;background:#16213e;color:#eee;font-size:12px;width:auto">';
        html += '<option value="false"' + (!s.showUsers ? ' selected' : '') + '>' + t('teams') + '</option>';
        html += '<option value="true"' + (s.showUsers ? ' selected' : '') + '>' + t('users') + '</option>';
        html += '</select></div></div>';

        html += '<div style="display:flex;align-items:flex-end;gap:12px;margin-bottom:12px">';
        html += '<div style="flex:1"><div style="font-weight:bold;margin-bottom:6px;color:#ccc">' + t('visibleColumns') + '</div>';
        html += '<div id="zoe-cfg-cols-wrap" style="position:relative;width:200px">';
        html += '<div id="zoe-cfg-cols-trigger" style="padding:4px 8px;border:1px solid #555;border-radius:4px;background:#16213e;color:#eee;font-size:12px;cursor:pointer;min-height:20px"></div>';
        html += '<div id="zoe-cfg-cols-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:1;background:#16213e;border:1px solid #555;border-radius:4px;margin-top:2px;max-height:120px;overflow-y:auto">';
        const cols = [
            { key: 'showTeams', label: t('teamsUsers') },
            { key: 'showElo', label: t('showElo') },
            { key: 'showLmv', label: t('showLmv') },
            { key: 'showStats', label: t('pointsMatches') }
        ];
        cols.forEach(c => {
            const checked = s[c.key] !== false ? 'checked' : '';
            html += '<label style="display:flex;align-items:center;padding:4px 8px;cursor:pointer;font-size:12px;color:#eee"><input type="checkbox" class="zoe-cfg-col-cb" value="' + c.key + '" ' + checked + ' style="margin-right:6px">' + c.label + '</label>';
        });
        html += '</div></div></div>';
        html += '<label id="zoe-cfg-ask-label" style="display:flex;align-items:center;gap:6px;font-size:12px;color:#eee;cursor:pointer;white-space:nowrap"><input type="checkbox" id="zoe-cfg-askBeforePost"' + (s.askBeforePost ? ' checked' : '') + ' style="cursor:pointer"> ' + t('askBefore') + '</label></div>';

        const escapedTemplate = (s.guestbookTemplate || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        html += '<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;position:relative">';
        html += '<div><span id="zoe-cfg-guestbook-label" style="font-weight:bold;margin-bottom:6px;color:' + accent + ';cursor:pointer;display:inline-block;text-decoration:underline dotted;text-underline-offset:3px">' + t('message') + '</span>';
        html += '<textarea id="zoe-cfg-guestbookTemplate" style="display:none">' + escapedTemplate + '</textarea></div>';
        const escapedChat = (s.chatTemplate || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        html += '<div style="position:relative"><label id="zoe-cfg-chat-label" style="display:flex;align-items:center;gap:6px;font-size:12px;color:' + accent + ';cursor:pointer;white-space:nowrap;font-weight:bold;text-decoration:underline dotted;text-underline-offset:3px">' + t('chat') + '<input type="checkbox" id="zoe-cfg-chatToManagers"' + (s.chatToManagers ? ' checked' : '') + ' style="cursor:pointer;width:16px;height:16px;flex-shrink:0"></label>';
        html += '<textarea id="zoe-cfg-chatTemplate" style="display:none">' + escapedChat + '</textarea>';
        html += '<div id="zoe-cfg-chat-tooltip" style="display:none;position:absolute;top:100%;left:0;margin-top:4px;z-index:2;background:#16213e;border:1px solid ' + accent + ';border-radius:6px;padding:8px 10px;font-size:11px;line-height:1.4;color:#ddd;width:240px;box-shadow:0 2px 12px rgba(0,0,0,0.6)">' + t('chatTooltip') + '</div></div>';
        html += '</div>';
                const flagCn = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 12" width="16" height="12"><rect width="16" height="12" fill="#de2910"/><g fill="#ffde00"><polygon points="2,1 2.5,2.5 1,2 2.5,1.5"/><polygon points="5,0 5.3,1 4,0.6"/><polygon points="6,1.5 6.3,2.5 5,2.1"/><polygon points="6,3.5 6.3,4.5 5,4.1"/><polygon points="5,5 5.3,6 4,5.6"/></g></svg>';
        html += '<div id="zoe-cn-flag-row" style="position:relative;display:flex;align-items:center;gap:10px;margin-bottom:12px"><label id="zoe-cn-flag-label" style="display:flex;align-items:center;gap:6px;font-size:12px;color:#eee;cursor:pointer;white-space:nowrap"><input type="checkbox" id="zoe-cfg-autoChineseSwitch"' + (s.autoChineseSwitch ? ' checked' : '') + ' style="cursor:pointer"> ' + flagCn + ' <span style="color:#f44336;font-size:16px;font-weight:bold;line-height:1">✖</span></label><div style="display:flex;align-items:center;gap:4px"><span style="font-size:11px;color:#ccc">' + t('sendMessageTo') + '</span><select id="zoe-cfg-boardType" style="padding:3px;border:1px solid #555;border-radius:4px;background:#16213e;color:#eee;font-size:11px;width:auto"><option value="none"' + (s.boardType === 'none' ? ' selected' : '') + '>' + t('none') + '</option><option value="open"' + (s.boardType === 'open' ? ' selected' : '') + '>' + t('open') + '</option><option value="federation"' + (s.boardType === 'federation' ? ' selected' : '') + '>' + t('federationMembers') + '</option><option value="team"' + (s.boardType === 'team' ? ' selected' : '') + '>' + t('firstTeamMembers') + '</option></select></div></div>';
        const showWarn = s.guestbookTemplate && s.guestbookTemplate.trim() && !/\*image\*/.test(s.guestbookTemplate) && !/\*image_stats\*/.test(s.guestbookTemplate);
        html += '<div id="zoe-cfg-no-image-warn" style="display:' + (showWarn ? 'block' : 'none') + ';margin-bottom:12px;padding:6px 8px;background:#3a1a1a;border:1px solid #f44336;border-radius:4px;color:#f44336;font-size:11px">' + t('noImageWarning') + '</div>';
        html += '</div>';

        html += '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px">';
        html += '<div style="flex:1;min-width:100px"><div style="font-weight:bold;margin-bottom:6px;color:#ccc">' + t('tableWidth') + '</div>';
        html += '<select id="zoe-cfg-tableWidth" style="padding:4px;border:1px solid #555;border-radius:4px;background:#16213e;color:#eee;font-size:12px;width:auto">';
        [50, 60, 75, 90, 100].forEach(v => {
            const sel = s.tableWidth === v ? ' selected' : '';
            html += '<option value="' + v + '"' + sel + '>' + v + '%</option>';
        });
        html += '</select></div>';

        html += '<div style="flex:1;min-width:130px"><div style="font-weight:bold;margin-bottom:6px;color:#ccc">' + t('resolution') + '</div>';
        html += '<select id="zoe-cfg-imgSize" style="padding:4px;border:1px solid #555;border-radius:4px;background:#16213e;color:#eee;font-size:12px;width:auto">';
        [
            { value: 'small', label: t('small') },
            { value: 'normal', label: t('normal') },
            { value: 'large', label: t('large') },
            { value: 'xlarge', label: t('xlarge') },
            { value: 'xxlarge', label: t('xxlarge') }
        ].forEach(o => {
            const sel = s.imgSize === o.value ? ' selected' : '';
            html += '<option value="' + o.value + '"' + sel + '>' + o.label + '</option>';
        });
        html += '</select></div>';

        html += '<div style="min-width:70px"><div id="zoe-cfg-quality-label" style="font-weight:bold;margin-bottom:6px;color:#ccc;cursor:default">' + t('quality') + '</div>';
        html += '<select id="zoe-cfg-imgScale" style="padding:4px;border:1px solid #555;border-radius:4px;background:#16213e;color:#eee;font-size:12px;width:auto">';
        [1, 2, 3].forEach(v => {
            const sel = (s.imgScale || 1) === v ? ' selected' : '';
            html += '<option value="' + v + '"' + sel + '>' + v + 'x</option>';
        });
        html += '</select></div>';
        html += '</div>';

        html += '<div style="margin-bottom:12px"><div style="font-weight:bold;margin-bottom:6px;color:#ccc">' + t('deleteImageAfter') + '</div>';
        html += '<select id="zoe-cfg-imgExpiration" style="padding:4px;border:1px solid #555;border-radius:4px;background:#16213e;color:#eee;font-size:12px;width:auto">';
        [
            { value: 604800, label: t('after1Week') },
            { value: 1209600, label: t('after2Weeks') },
            { value: 1814400, label: t('after3Weeks') },
            { value: 2592000, label: t('after1Month') },
            { value: 5184000, label: t('after2Months') },
            { value: 7776000, label: t('after3Months') },
            { value: 15552000, label: t('after6Months') }
        ].forEach(o => {
            const selected = s.imgExpiration === o.value ? 'selected' : '';
            html += '<option value="' + o.value + '" ' + selected + '>' + o.label + '</option>';
        });
        html += '</select></div>';

        html += '<div style="display:flex;align-items:center;flex-wrap:nowrap;gap:6px;margin-bottom:12px;white-space:nowrap"><span style="font-weight:bold;color:#ccc">' + t('auto') + '</span><input type="checkbox" id="zoe-cfg-autoRun"' + (s.autoRun ? ' checked' : '') + ' style="cursor:pointer;width:16px;height:16px;flex-shrink:0">';
        html += '<span style="font-size:11px;color:#888;margin-left:4px">' + t('run') + '</span> <input type="text" id="zoe-cfg-autoRunBefore" value="' + s.autoRunBefore + '" style="width:30px;padding:4px 4px;border:1px solid #555;border-radius:4px;background:#16213e;color:#eee;font-size:12px;text-align:center;outline:none">';
        html += ' <span style="font-size:11px;color:#888">' + t('hoursBeforeNextRound') + '</span>';
        html += '</div>';

        html += '<div style="display:flex;align-items:center;flex-wrap:nowrap;gap:6px;margin-bottom:12px;white-space:nowrap"><span id="zoe-cfg-autoMsg-label" style="font-weight:bold;color:' + accent + ';cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px">' + t('autoMessage') + '</span><input type="checkbox" id="zoe-cfg-autoMessage"' + (s.autoMessage ? ' checked' : '') + ' style="cursor:pointer;width:16px;height:16px;flex-shrink:0">';
        html += '<span style="font-size:11px;color:#888;margin-left:4px">' + t('run') + '</span> <input type="text" id="zoe-cfg-autoMessageBefore" value="' + s.autoMessageBefore + '" style="width:30px;padding:4px 4px;border:1px solid #555;border-radius:4px;background:#16213e;color:#eee;font-size:12px;text-align:center;outline:none">';
        html += ' <span style="font-size:11px;color:#888">' + t('hoursBeforeNextRound') + '</span>';
        html += '<textarea id="zoe-cfg-autoMessageTemplate" style="display:none">' + (s.autoMessageTemplate || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') + '</textarea>';
        html += '</div>';

        html += '<label id="zoe-cfg-sendLogs-label" title="' + t('sendDiagnosticLogsTooltip') + '" style="display:flex;align-items:center;gap:6px;margin-bottom:12px;font-size:12px;color:#eee;cursor:pointer;white-space:nowrap"><input type="checkbox" id="zoe-cfg-sendDiagnosticLogs"' + (s.sendDiagnosticLogs ? ' checked' : '') + ' style="cursor:pointer;width:16px;height:16px;flex-shrink:0">' + t('sendDiagnosticLogs') + '</label>';

        html += '<div style="display:flex;justify-content:flex-end;align-items:center;gap:12px"><a href="https://www.managerzone.com/?p=profile&uid=6921358&sport=soccer" target="_blank" id="zoe-cfg-sugestao-link" style="color:#f44336;font-size:12px;text-decoration:none;cursor:pointer;margin-right:auto">' + t('suggestions') + '</a><button id="zoe-cfg-version-history" style="background:#555;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">' + t('versionHistory') + '</button><button id="zoe-cfg-check-updates" style="background:#555;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">' + t('checkUpdates') + '</button><button id="zoe-clash-cfg-save" style="background:' + accent + ';color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">' + t('save') + '</button></div>';

        panel.innerHTML = html;
        doc.body.appendChild(panel);

        // Event listener para dropdown customizado de idioma
        const langTrigger = document.getElementById('zoe-cfg-language');
        const langDropdown = document.getElementById('zoe-lang-dropdown');
        if (langTrigger && langDropdown) {
            langTrigger.onclick = (e) => {
                e.stopPropagation();
                langDropdown.style.display = langDropdown.style.display === 'block' ? 'none' : 'block';
            };

            document.addEventListener('mousedown', (e) => {
                if (!langTrigger.contains(e.target) && !langDropdown.contains(e.target)) {
                    langDropdown.style.display = 'none';
                }
            });

            const langOptions = langDropdown.querySelectorAll('.zoe-lang-option');
            langOptions.forEach(opt => {
                opt.onclick = (e) => {
                    e.stopPropagation();
                    const newLang = opt.dataset.lang;
                    if (setLanguage(newLang)) {
                        langDropdown.style.display = 'none';
                        panel.remove();
                        showClashSettings(sport);
                    }
                };
            });
        }

        const tipEl = doc.createElement('div');
        tipEl.style.cssText = 'position:fixed;z-index:99999999;padding:6px 10px;background:#16213e;color:#ddd;border:1px solid ' + accent + ';border-radius:6px;font-size:11px;pointer-events:none;display:none;white-space:nowrap;box-shadow:0 2px 12px rgba(0,0,0,0.6)';
        tipEl.textContent = t('chineseTooltip');
        doc.body.appendChild(tipEl);
        const flagLabel = panel.querySelector('#zoe-cn-flag-label');
        if (flagLabel) {
            flagLabel.onmouseenter = (e) => {
                tipEl.style.display = 'block';
                tipEl.textContent = t('chineseTooltip');
                const r = flagLabel.getBoundingClientRect();
                tipEl.style.left = r.left + 'px';
                tipEl.style.top = (r.bottom + 4) + 'px';
            };
            flagLabel.onmouseleave = () => { tipEl.style.display = 'none'; };
        }

        const sugLink = panel.querySelector('#zoe-cfg-sugestao-link');
        if (sugLink) {
            sugLink.onmouseenter = () => {
                tipEl.style.display = 'block';
                tipEl.textContent = t('sendSuggestions');
                const r = sugLink.getBoundingClientRect();
                tipEl.style.left = r.left + 'px';
                tipEl.style.top = (r.top - 30) + 'px';
            };
            sugLink.onmouseleave = () => { tipEl.style.display = 'none'; tipEl.textContent = t('chineseTooltip'); };
        }

        const qualityLabel = panel.querySelector('#zoe-cfg-quality-label');
        if (qualityLabel) {
            qualityLabel.onmouseenter = () => {
                tipEl.style.display = 'block';
                tipEl.textContent = t('imageQuality');
                const r = qualityLabel.getBoundingClientRect();
                tipEl.style.left = r.left + 'px';
                tipEl.style.top = (r.bottom + 4) + 'px';
            };
            qualityLabel.onmouseleave = () => { tipEl.style.display = 'none'; tipEl.textContent = t('chineseTooltip'); };
        }

        const askLabel = panel.querySelector('#zoe-cfg-ask-label');
        if (askLabel) {
            askLabel.onmouseenter = () => {
                tipEl.style.display = 'block';
                tipEl.textContent = t('askBeforeTooltip');
                const r = askLabel.getBoundingClientRect();
                tipEl.style.left = r.left + 'px';
                tipEl.style.top = (r.bottom + 4) + 'px';
            };
            askLabel.onmouseleave = () => { tipEl.style.display = 'none'; };
        }

        const span = doc.createElement('span');
        span.style.cssText = 'position:absolute;visibility:hidden;font:12px Arial,sans-serif;white-space:nowrap';
        doc.body.appendChild(span);
        panel.querySelectorAll('select:not(#zoe-cfg-language)').forEach(sel => {
            span.textContent = sel.parentElement.querySelector('div[style*="font-weight:bold"]')?.textContent || '';
            let maxW = span.offsetWidth;
            Array.from(sel.options).forEach(o => { span.textContent = o.text; if (span.offsetWidth > maxW) maxW = span.offsetWidth; });
            sel.style.width = (maxW + 28) + 'px';
        });
        span.remove();

        const colsTrigger = panel.querySelector('#zoe-cfg-cols-trigger');
        const colsDropdown = panel.querySelector('#zoe-cfg-cols-dropdown');
        const colsCbs = panel.querySelectorAll('.zoe-cfg-col-cb');
        function updateColsLabel() {
            const n = panel.querySelectorAll('.zoe-cfg-col-cb:checked').length;
            colsTrigger.textContent = n + ' de ' + colsCbs.length + ' ' + t('selectedCount');
        }
        updateColsLabel();
        colsTrigger.onclick = () => { colsDropdown.style.display = colsDropdown.style.display === 'none' ? 'block' : 'none'; };
        colsCbs.forEach(cb => { cb.onchange = () => updateColsLabel(); });
        doc.addEventListener('mousedown', (e) => {
            if (!panel.querySelector('#zoe-cfg-cols-wrap').contains(e.target)) colsDropdown.style.display = 'none';
        });

        const clashTypeEl = panel.querySelector('#zoe-cfg-clashType');
        const offerOptsEl = panel.querySelector('#zoe-cfg-offer-opts');
        if (clashTypeEl) clashTypeEl.onchange = () => {
            offerOptsEl.style.display = clashTypeEl.value === 'offer' ? 'block' : 'none';
        };

        const closeBtn = panel.querySelector('#zoe-clash-cfg-close');
        if (closeBtn) closeBtn.onclick = () => panel.remove();

        const arbInput = panel.querySelector('#zoe-cfg-autoRunBefore');
        function arbClamp(val) { return Math.min(Math.max(val, 0), 21); }
        function arbUpdate() {
            let v = parseInt(arbInput.value, 10);
            if (isNaN(v)) v = 0;
            arbInput.value = arbClamp(v);
        }
        if (arbInput) arbInput.onkeydown = (e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); const v = parseInt(arbInput.value, 10) || 0; arbInput.value = arbClamp(v + 1); }
            if (e.key === 'ArrowDown') { e.preventDefault(); const v = parseInt(arbInput.value, 10) || 0; arbInput.value = arbClamp(v - 1); }
        };
        if (arbInput) arbInput.oninput = () => {
            const v = parseInt(arbInput.value, 10);
            if (!isNaN(v)) arbInput.value = arbClamp(v);
        };
        if (arbInput) arbInput.onblur = arbUpdate;

        const ambInput = panel.querySelector('#zoe-cfg-autoMessageBefore');
        function ambClamp(val) { return Math.min(Math.max(val, 12), 48); }
        function ambUpdate() {
            let v = parseInt(ambInput.value, 10);
            if (isNaN(v)) v = 24;
            ambInput.value = ambClamp(v);
        }
        if (ambInput) ambInput.onkeydown = (e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); const v = parseInt(ambInput.value, 10) || 24; ambInput.value = ambClamp(v + 1); }
            if (e.key === 'ArrowDown') { e.preventDefault(); const v = parseInt(ambInput.value, 10) || 24; ambInput.value = ambClamp(v - 1); }
        };
        if (ambInput) ambInput.oninput = () => {
            const v = parseInt(ambInput.value, 10);
            if (!isNaN(v)) ambInput.value = ambClamp(v);
        };
        if (ambInput) ambInput.onblur = ambUpdate;

        const chatLabel = panel.querySelector('#zoe-cfg-chat-label');
        const chatTooltip = panel.querySelector('#zoe-cfg-chat-tooltip');
        if (chatLabel && chatTooltip) {
            chatLabel.onmouseenter = () => { chatTooltip.style.display = 'block'; };
            chatLabel.onmouseleave = () => { chatTooltip.style.display = 'none'; };
        }
        if (chatLabel) chatLabel.onclick = (e) => {
            const cb = panel.querySelector('#zoe-cfg-chatToManagers');
            if (e.target === cb) return;
            e.preventDefault();
            const modal = doc.createElement('div');
            modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000000;background:#1a1a2e;border:2px solid ' + accent + ';border-radius:10px;padding:16px 10px;font-family:Arial,sans-serif;color:#eee;font-size:13px;width:85%;max-width:460px;box-shadow:0 4px 24px rgba(0,0,0,0.7)';
            const chatS = getClashSettings(sport);
            const chatEsc = (chatS.chatTemplate || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            modal.innerHTML = '<div style="display:flex;align-items:center;margin-bottom:12px;position:relative"><b style="font-size:14px;color:' + accent + ';width:100%;text-align:center">' + t('chatModalTitle') + '</b><span id="zoe-cfg-chat-close" style="cursor:pointer;font-size:16px;color:#999;position:absolute;right:0;top:0">&times;</span></div>';
            modal.innerHTML += '<textarea id="zoe-cfg-chat-template" style="width:100%;padding:6px;border:1px solid #555;border-radius:4px;background:#16213e;color:#eee;font-size:12px;box-sizing:border-box;resize:vertical;overflow:hidden">' + chatEsc + '</textarea>';
            modal.innerHTML += '<div style="font-size:11px;color:#888;margin-top:4px;line-height:1.5"><br>' + t('chatModalVariables') + ' <b>*user*</b>, <b>*team*</b>, <b>*elo*</b>, <b>*LMV*</b> ' + t('chatModalOurFed') + ' e <b>*user_rival*</b>, <b>*team_rival*</b>, <b>*elo_rival*</b>, <b>*LMV_rival*</b> ' + t('chatModalRivalFed') + ', <b>*elo_dif*</b>, <b>*LMV_dif*</b> ' + t('chatModalDifBetween') + '<br>' + t('chatModalRoundEquals') + ', ' + t('chatModalSeasonEquals') + ', ' + t('chatModalDivisionEquals') + '.</div>';
            modal.innerHTML += '<div style="margin-top:8px"><div style="position:relative;display:inline-block"><button id="zoe-chat-example-btn" style="background:#2a2f3a;color:#fff;border:1px solid #555;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:11px;font-family:Arial,sans-serif">' + t('chatModalExample') + '</button><div id="zoe-chat-example-tooltip" style="display:none;position:absolute;bottom:100%;left:0;margin-bottom:4px;z-index:100;background:#16213e;border:1px solid #555;border-radius:6px;padding:8px 10px;font-size:11px;line-height:1.4;color:#ddd;width:325px;box-shadow:0 2px 12px rgba(0,0,0,0.6)">' + t('chatModalUserHere') + '<br>' + t('chatModalUserTeam') + '<br>' + t('chatModalUserRivalTeam') + '<br>' + t('chatModalSummary') + '<br><br>' + t('chatModalOutput') + ':<br>' + t('chatModalExampleOutput') + '<br>' + t('chatModalExampleOutput2') + '<br>' + t('chatModalExampleOutput3') + '<br>' + t('chatModalExampleOutput4') + '</div></div></div>';
            modal.innerHTML += '<div style="font-size:11px;color:#888;margin-top:8px">' + t('chatModalLimit') + '</div>';
            modal.innerHTML += '<div style="display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:12px"><button id="zoe-cfg-chat-test" style="background:#ff9800;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">' + t('chatModalTest') + '</button><button id="zoe-cfg-chat-save" style="background:' + accent + ';color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">' + t('templateModalSave') + '</button></div>';
            modal.querySelector('#zoe-chat-example-btn').onmouseenter = () => { modal.querySelector('#zoe-chat-example-tooltip').style.display = 'block'; };
            modal.querySelector('#zoe-chat-example-btn').onmouseleave = () => { modal.querySelector('#zoe-chat-example-tooltip').style.display = 'none'; };
            doc.body.appendChild(modal);
            const chatTa = modal.querySelector('#zoe-cfg-chat-template');
            function chatAutoSize() { chatTa.style.height = 'auto'; chatTa.style.height = chatTa.scrollHeight + 'px'; }
            chatAutoSize();
            chatTa.oninput = chatAutoSize;
            modal.querySelector('#zoe-cfg-chat-close').onclick = () => modal.remove();
            const chatTestBtn = modal.querySelector('#zoe-cfg-chat-test');
            if (chatTestBtn) chatTestBtn.onclick = () => {
                const template = modal.querySelector('#zoe-cfg-chat-template').value;
                panel.querySelector('#zoe-cfg-chatTemplate').value = template;
                const cur = getClashConfig(sport) || {};
                saveClashConfig(sport, Object.assign({}, cur, { chatTemplate: template }));
                testChatMessages(sport).catch(function(e) { console.log('ZOE Chat: erro no teste:', e); });
            };
            modal.querySelector('#zoe-cfg-chat-save').onclick = () => {
                const template = modal.querySelector('#zoe-cfg-chat-template').value;
                panel.querySelector('#zoe-cfg-chatTemplate').value = template;
                const cur = getClashConfig(sport) || {};
                const newCfg = Object.assign({}, cur, { chatTemplate: template });
                saveClashConfig(sport, newCfg);
                console.log('ZOE Clash: chat guardado (' + sport + '):', JSON.stringify(template));
                modal.remove();
            };
        };

        const gbLabel = panel.querySelector('#zoe-cfg-guestbook-label');
        if (gbLabel) gbLabel.onclick = () => {
            const modal = doc.createElement('div');
            modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000000;background:#1a1a2e;border:2px solid ' + accent + ';border-radius:10px;padding:16px 10px;font-family:Arial,sans-serif;color:#eee;font-size:13px;width:85%;max-width:460px;box-shadow:0 4px 24px rgba(0,0,0,0.7)';
            const gbS = getClashSettings(sport);
            const gbEsc = (gbS.guestbookTemplate || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            modal.innerHTML = '<div style="display:flex;align-items:center;margin-bottom:12px;position:relative"><b style="font-size:14px;color:' + accent + ';width:100%;text-align:center">' + t('templateModalTitle') + '</b><span id="zoe-cfg-gb-close" style="cursor:pointer;font-size:16px;color:#999;position:absolute;right:0;top:0">&times;</span></div>';
            modal.innerHTML += '<textarea id="zoe-cfg-gb-template" style="width:100%;padding:6px;border:1px solid #555;border-radius:4px;background:#16213e;color:#eee;font-size:12px;box-sizing:border-box;resize:vertical;overflow:hidden">' + gbEsc + '</textarea>';
            modal.innerHTML += '<div style="font-size:11px;color:#888;margin-top:4px">' + t('availableVariables') + ' <b>*round*</b>=' + t('varDescRound') + ', <b>*season*</b>=' + t('varDescSeason') + ', <b>*division*</b>=' + t('varDescDivision') + ', <b>*rival*</b>=' + t('varDescRival') + ', <b>*image*</b>=' + t('varDescImage') + ', <b>*image_stats*</b>=' + t('varDescImageStats') +', <b>*url*</b>=' + t('varDescUrl') + '</div>';
            modal.innerHTML += '<div style="display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:12px"><button id="zoe-cfg-gb-test" style="background:#ff9800;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">Pré-Vizualização</button><button id="zoe-cfg-gb-save" style="background:' + accent + ';color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">' + t('templateModalSave') + '</button></div>';
            doc.body.appendChild(modal);
            const gbTa = modal.querySelector('#zoe-cfg-gb-template');
            function gbAutoSize() { gbTa.style.height = 'auto'; gbTa.style.height = gbTa.scrollHeight + 'px'; }
            gbAutoSize();
            gbTa.oninput = gbAutoSize;
            modal.querySelector('#zoe-cfg-gb-close').onclick = () => modal.remove();
            modal.querySelector('#zoe-cfg-gb-test').onclick = () => {
                const template = modal.querySelector('#zoe-cfg-gb-template').value;
                panel.querySelector('#zoe-cfg-guestbookTemplate').value = template;
                const cur = getClashConfig(sport) || {};
                saveClashConfig(sport, Object.assign({}, cur, { guestbookTemplate: template }));
                testClashScreenshot(sport, Object.assign({}, getClashSettings(sport), { guestbookTemplate: template }));
            };
            modal.querySelector('#zoe-cfg-gb-save').onclick = () => {
                const template = modal.querySelector('#zoe-cfg-gb-template').value;
                panel.querySelector('#zoe-cfg-guestbookTemplate').value = template;
                const cur = getClashConfig(sport) || {};
                const newCfg = Object.assign({}, cur, { guestbookTemplate: template });
                saveClashConfig(sport, newCfg);
                console.log('ZOE Clash: mensagem guardada (' + sport + '):', JSON.stringify(template));
                const warnEl = panel.querySelector('#zoe-cfg-no-image-warn');
                const showWarn2 = template && template.trim() && !/\*image\*/.test(template) && !/\*image_stats\*/.test(template);
                if (warnEl) warnEl.style.display = showWarn2 ? 'block' : 'none';
                updateClashGearColor(sport, newCfg);
                modal.remove();
            };
        };

        const ambLabel = panel.querySelector('#zoe-cfg-autoMsg-label');
        if (ambLabel) ambLabel.onclick = () => {
            const modal = doc.createElement('div');
            modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000000;background:#1a1a2e;border:2px solid ' + accent + ';border-radius:10px;padding:16px 10px;font-family:Arial,sans-serif;color:#eee;font-size:13px;width:85%;max-width:460px;box-shadow:0 4px 24px rgba(0,0,0,0.7)';
            const curS = getClashSettings(sport);
            const escTemplate = (curS.autoMessageTemplate || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            modal.innerHTML = '<div style="display:flex;align-items:center;margin-bottom:12px;position:relative"><b style="font-size:14px;color:' + accent + ';width:100%;text-align:center">' + t('autoMessage') + '</b><span id="zoe-cfg-amsg-close" style="cursor:pointer;font-size:16px;color:#999;position:absolute;right:0;top:0">&times;</span></div>';
            modal.innerHTML += '<textarea id="zoe-cfg-autoMessageTemplate" style="width:100%;padding:6px;border:1px solid #555;border-radius:4px;background:#16213e;color:#eee;font-size:12px;box-sizing:border-box;resize:vertical;overflow:hidden">' + escTemplate + '</textarea>';
            modal.innerHTML += '<div style="display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:12px"><button id="zoe-cfg-amsg-save" style="background:' + accent + ';color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">' + t('templateModalSave') + '</button></div>';
            doc.body.appendChild(modal);
            const ambTa = modal.querySelector('#zoe-cfg-autoMessageTemplate');
            function ambAutoSize() { ambTa.style.height = 'auto'; ambTa.style.height = ambTa.scrollHeight + 'px'; }
            ambAutoSize();
            ambTa.oninput = ambAutoSize;
            modal.querySelector('#zoe-cfg-amsg-close').onclick = () => modal.remove();
            modal.querySelector('#zoe-cfg-amsg-save').onclick = () => {
                const template = modal.querySelector('#zoe-cfg-autoMessageTemplate').value;
                panel.querySelector('#zoe-cfg-autoMessageTemplate').value = template;
                const cur = getClashConfig(sport) || {};
                const newCfg = Object.assign({}, cur, { autoMessageTemplate: template });
                saveClashConfig(sport, newCfg);
                console.log('ZOE AutoMsg: template guardado (' + sport + '):', JSON.stringify(template));
                scheduleAutoMessage(sport).catch(function(e) { console.log('ZOE AutoMsg: erro ao agendar:', e); });
                modal.remove();
            };
        };

        const labelMap = [
            { labelId: 'zoe-cfg-guestbook-label', templateId: 'zoe-cfg-guestbookTemplate' },
            { labelId: 'zoe-cfg-chat-label', templateId: 'zoe-cfg-chatTemplate' },
            { labelId: 'zoe-cfg-autoMsg-label', templateId: 'zoe-cfg-autoMessageTemplate' }
        ];
        function updateConfigLabelColors() {
            const accent = getSportAccent(sport);
            labelMap.forEach(({ labelId, templateId }) => {
                const label = panel.querySelector('#' + labelId);
                const textarea = panel.querySelector('#' + templateId);
                if (label && textarea) {
                    const hasContent = textarea.value && textarea.value.trim().length > 0;
                    label.style.color = hasContent ? accent : '#f44336';
                }
            });
        }
        updateConfigLabelColors();
        labelMap.forEach(({ templateId }) => {
            const textarea = panel.querySelector('#' + templateId);
            if (textarea) textarea.addEventListener('input', updateConfigLabelColors);
        });

        const saveBtn = panel.querySelector('#zoe-clash-cfg-save');
        saveBtn.onclick = () => {
            const selectedCols = Array.from(panel.querySelectorAll('.zoe-cfg-col-cb:checked')).map(cb => cb.value);
            const newCfg = {
                clashType: clashTypeEl ? clashTypeEl.value : 'elo',
                teamsOffered: parseInt(panel.querySelector('#zoe-cfg-teamsOffered').value) || 1,
                showUsers: panel.querySelector('#zoe-cfg-showUsers').value === 'true',
                tableWidth: parseInt(panel.querySelector('#zoe-cfg-tableWidth').value) || 75,
                imgSize: panel.querySelector('#zoe-cfg-imgSize').value || 'normal',
                imgScale: parseInt(panel.querySelector('#zoe-cfg-imgScale').value) || 1,
                showTeams: selectedCols.includes('showTeams'),
                showElo: selectedCols.includes('showElo'),
                showLmv: selectedCols.includes('showLmv'),
                showStats: selectedCols.includes('showStats'),
                guestbookTemplate: panel.querySelector('#zoe-cfg-guestbookTemplate').value,
                imgExpiration: parseInt(panel.querySelector('#zoe-cfg-imgExpiration').value) || 604800,
                askBeforePost: panel.querySelector('#zoe-cfg-askBeforePost').checked,
                autoChineseSwitch: panel.querySelector('#zoe-cfg-autoChineseSwitch').checked,
                boardType: panel.querySelector('#zoe-cfg-boardType').value,
                autoRun: panel.querySelector('#zoe-cfg-autoRun').checked,
                autoRunBefore: Math.min(Math.max(parseInt(panel.querySelector('#zoe-cfg-autoRunBefore').value, 10) || 0, 0), 21),
                autoMessage: panel.querySelector('#zoe-cfg-autoMessage').checked,
                autoMessageBefore: Math.min(Math.max(parseInt(panel.querySelector('#zoe-cfg-autoMessageBefore').value, 10) || 24, 12), 48),
                autoMessageTemplate: panel.querySelector('#zoe-cfg-autoMessageTemplate').value,
                chatToManagers: panel.querySelector('#zoe-cfg-chatToManagers').checked,
                chatTemplate: panel.querySelector('#zoe-cfg-chatTemplate').value,
                sendDiagnosticLogs: panel.querySelector('#zoe-cfg-sendDiagnosticLogs').checked
            };
            saveClashConfig(sport, newCfg);
            console.log('ZOE Clash config guardada (' + sport + '):', JSON.stringify(newCfg));
            const warnEl = panel.querySelector('#zoe-cfg-no-image-warn');
            if (newCfg.guestbookTemplate && newCfg.guestbookTemplate.trim() && !/\*image\*/.test(newCfg.guestbookTemplate)) {
                if (warnEl) warnEl.style.display = 'block';
            } else {
                if (warnEl) warnEl.style.display = 'none';
            }
            updateClashGearColor(sport, newCfg);
            scheduleAutoRun(sport).catch(function(e) { console.log('ZOE AutoRun: erro ao agendar:', e); });
            scheduleAutoMessage(sport).catch(function(e) { console.log('ZOE AutoMsg: erro ao agendar:', e); });
            panel.remove();
        };

        const checkUpdatesBtn = panel.querySelector('#zoe-cfg-check-updates');
        if (checkUpdatesBtn) {
            checkUpdatesBtn.onclick = () => {
                checkUpdatesBtn.disabled = true;
                checkUpdatesBtn.textContent = '...';
                checkForUpdates(true).then(() => {
                    checkUpdatesBtn.disabled = false;
                    checkUpdatesBtn.textContent = t('checkUpdates');
                }).catch(() => {
                    checkUpdatesBtn.disabled = false;
                    checkUpdatesBtn.textContent = t('checkUpdates');
                });
            };
        }

        const versionHistoryBtn = panel.querySelector('#zoe-cfg-version-history');
        if (versionHistoryBtn) {
            versionHistoryBtn.onclick = () => { showVersionHistory(); };
        }
    }

    // --- AutoRun ---

    // Função para limpar o cache do calendário (útil para debugging)
    window.clearZoeScheduleCache = function(sport) {
        const cacheKey = 'zoe_schedule_' + (sport || 'hockey');
        GM_setValue(cacheKey, 'null');
        console.log('ZOE: cache do calendário limpo para', cacheKey);
    };

    // Função para limpar o estado de skipRound (forçar reprocessamento de uma jornada)
    window.clearZoeSkipRound = function(sport) {
        const skipKey = 'zoe_skip_round_' + (sport || 'hockey');
        GM_setValue(skipKey, 'null');
        console.log('ZOE: skipRound limpo para', skipKey);
    };

    // Expor GM_setValue globalmente para debugging via console
    window.zoeSetCache = function(key, value) {
        GM_setValue(key, value);
        console.log('ZOE: cache definido', key, '=', value);
    };

    // Escolhe a jornada alvo: a que ainda está dentro da janela (24h após o início da jornada)
    // mesmo que já tenha começado; senão, a próxima jornada futura.
    function findTargetRound(rounds, now) {
        if (!rounds || rounds.length === 0) return null;
        const sorted = rounds.slice().sort((a, b) => a.ts - b.ts);
        console.log('ZOE AutoRun: data atual:', new Date(now).toLocaleString());

        for (let i = 0; i < sorted.length; i++) {
            // Janela: 24 horas após o início da jornada
            const roundDate = new Date(sorted[i].ts);
            const start = new Date(sorted[i].ts);
            start.setHours(0, 0, 0, 0); // Início do dia da jornada
            const end = new Date(sorted[i].ts);
            end.setHours(roundDate.getHours() + 24, roundDate.getMinutes(), 0, 0); // 24h após o início

            console.log('ZOE AutoRun: jornada #' + sorted[i].round + ' janela: ' + start.toLocaleString() + ' a ' + end.toLocaleString());

            if (now >= start.getTime() && now <= end.getTime()) {
                console.log('ZOE AutoRun: jornada #' + sorted[i].round + ' está na janela, selecionada');
                return sorted[i];
            }
        }
        // Se nenhuma jornada estiver na janela, retornar a próxima jornada futura
        console.log('ZOE AutoRun: nenhuma jornada na janela, a buscar próxima jornada futura');
        for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].ts > now) {
                console.log('ZOE AutoRun: próxima jornada futura: #' + sorted[i].round);
                return sorted[i];
            }
        }
        return sorted[sorted.length - 1];
    }

    async function fetchNextRoundData(sport) {
        const cacheKey = 'zoe_schedule_' + sport;
        let cached = null;
        try { cached = JSON.parse(GM_getValue(cacheKey, 'null')); } catch(e) { cached = null; }

        // Ignorar cache se não tiver timestamp (cache antigo) ou se tiver mais de 0 minutos (sempre refrescar)
        if (cached && cached.allRounds && cached.allRounds.length > 0) {
            const cacheAge = cached._timestamp ? (Date.now() - cached._timestamp) : Infinity;
            if (!cached._timestamp || cacheAge > 0) { // 0 minutos (sempre refrescar)
                console.log('ZOE AutoRun: cache sem timestamp ou antigo (' + (cacheAge === Infinity ? 'sem timestamp' : Math.floor(cacheAge/60000) + ' min') + '), a refrescar');
                GM_setValue(cacheKey, 'null'); // Limpar o cache antigo
                cached = null;
            } else {
                const target = findTargetRound(cached.allRounds, Date.now());
                if (target && target.round === cached.round) {
                    console.log('ZOE AutoRun: calendário em cache, usar');
                    return cached;
                } else {
                    console.log('ZOE AutoRun: cache com round incorreto, a refrescar');
                    GM_setValue(cacheKey, 'null'); // Limpar o cache com round incorreto
                    cached = null;
                }
            }
        }

        let ourFedId = getOurFedId() || '';
        if (!ourFedId) {
            try {
                const discoveryHtml = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET', url: 'https://www.managerzone.com/?p=federations&changesport=' + sport + '&_nocache=' + Date.now(),
                        onload: (r) => resolve(r.responseText),
                        onerror: () => reject(), ontimeout: () => reject()
                    });
                });
                const logoMatch = discoveryHtml.match(/pic\.php\?type=federation(?:&amp;|&)fid=(\d+)/i);
                if (logoMatch) { saveOurFedId(logoMatch[1]); ourFedId = logoMatch[1]; }
            } catch(e) {}
            if (!ourFedId) { console.log('ZOE AutoRun: sem fed ID'); return null; }
        }
        const pageUrl = 'https://www.managerzone.com/?p=federations&sub=league&changesport=' + sport + '&fid=' + ourFedId + '&_nocache=' + Date.now();
        console.log('ZOE AutoRun: a buscar página league:', pageUrl);
        try {
            const html = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET', url: pageUrl,
                    onload: (r) => resolve(r.responseText),
                    onerror: () => reject('Erro'), ontimeout: () => reject('Timeout')
                });
            });
            let season = '';
            let division = '';

            const ajaxUrlMatches = (html.match(/ajax\.php\?p=federations&sub=schedule[^"']+/g) || [])
                .map(u => u.replace(/&amp;/g, '&'));
            const ajaxUrlWithDiv = ajaxUrlMatches.find(u => /[?&]level=\d+/.test(u) && /[?&]div=\d+/.test(u));
            const scrapedUrl = ajaxUrlWithDiv || ajaxUrlMatches[0];
            if (!scrapedUrl) { console.log('ZOE AutoRun: URL schedule AJAX não encontrada'); return null; }
            let scheduleAjaxUrl = 'https://www.managerzone.com/' + scrapedUrl;
            console.log('ZOE AutoRun: AJAX schedule URL:', scheduleAjaxUrl);

            const fetchScheduleAjax = (url) => new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET', url,
                    onload: (r) => resolve(r.responseText || ''),
                    onerror: () => resolve(''), ontimeout: () => resolve('')
                });
            });

            let ajaxHtml = await fetchScheduleAjax(scheduleAjaxUrl);
            console.log('ZOE AutoRun: AJAX resposta length:', ajaxHtml.length);

            const seasonMatch = ajaxHtml.match(/data-season='(\d+)'[^>]*data-sub-season='(\d+)'/);
            if (seasonMatch) season = seasonMatch[1] + '.' + seasonMatch[2];
            if (!season) {
                const pageSeasonMatch = html.match(/[ÉE]poca\s+([\d.]+)/i);
                if (pageSeasonMatch) season = pageSeasonMatch[1];
            }
            const pageDivMatch = html.match(/title=["'][^"']*ivis[^"']*\s+([\d.]+)["']/i);
            if (pageDivMatch) {
                division = pageDivMatch[1];
                console.log('ZOE AutoRun: divisão extraída do título da página:', division);
            }
            if (!division) {
                console.log('ZOE AutoRun: title="Division" não encontrado no HTML da federação, tentando DOM atual');
                const domDivLink = document.querySelector('.top-pane__season a[title*="ivis"]');
                if (domDivLink) {
                    const domDivMatch = domDivLink.title.match(/([\d.]+)\s*$/);
                    if (domDivMatch) { division = domDivMatch[1]; console.log('ZOE AutoRun: divisão extraída do DOM atual:', division); }
                }
            }
            if (!division) {
                const divMatch = scheduleAjaxUrl.match(/level=(\d+)&div=(\d+)/);
                if (divMatch) division = divMatch[1] + '.' + divMatch[2];
            }

            // URL sem level/div (ex.: hóquei): reconstruir a partir da divisão e validar que o calendário contém a nossa fed
            const ourFidRe = new RegExp('fid=' + ourFedId + '(?![0-9])');
            if (!ourFidRe.test(ajaxHtml) && division) {
                const divParts = division.split('.').map(n => parseInt(n, 10));
                if (divParts.length === 2 && !isNaN(divParts[0]) && !isNaN(divParts[1]) && divParts[1] >= 1) {
                    // divisão "X.Y" ↔ level=(X+1)&div=Y; testar também X e X-1
                    const candidates = [...new Set([divParts[0] + 1, divParts[0], divParts[0] - 1])].filter(l => l >= 1);
                    for (const lev of candidates) {
                        const candidateUrl = 'https://www.managerzone.com/ajax.php?p=federations&sub=schedule&level=' + lev + '&div=' + divParts[1] + '&sport=' + sport;
                        console.log('ZOE AutoRun: calendário sem fid=' + ourFedId + ', a tentar URL alternativo:', candidateUrl);
                        const candidateHtml = await fetchScheduleAjax(candidateUrl);
                        if (candidateHtml && ourFidRe.test(candidateHtml)) {
                            console.log('ZOE AutoRun: URL alternativo válido — level=' + lev + '&div=' + divParts[1]);
                            scheduleAjaxUrl = candidateUrl;
                            ajaxHtml = candidateHtml;
                            break;
                        }
                    }
                    if (!ourFidRe.test(ajaxHtml)) {
                        console.log('ZOE AutoRun: nenhum URL alternativo contém fid=' + ourFedId + ', a manter resposta original');
                    }
                }
                if (!season) {
                    const seasonRetry = ajaxHtml.match(/data-season='(\d+)'[^>]*data-sub-season='(\d+)'/);
                    if (seasonRetry) season = seasonRetry[1] + '.' + seasonRetry[2];
                }
            }
            const levMatch = scheduleAjaxUrl.match(/level=(\d+)/);
            const dviMatch = scheduleAjaxUrl.match(/[?&]div=(\d+)/);
            const ajaxLevel = levMatch ? levMatch[1] : null;
            const ajaxDiv = dviMatch ? dviMatch[1] : null;

            const rounds = [];
            const now = Date.now();
            const currentYear = new Date().getFullYear();
            // formato antigo: "Jornada N - 07/08/2026 15:00" (numérico)
            const numDateRe = /(\d{1,2})[-.\/](\d{1,2})[-.\/](\d{4})\s+(\d{1,2}):(\d{2})/g;
            // formato novo: "Jornada N - Aug 7 2026, 15:00" (mês por extenso)
            const namedDateRe = /([A-Za-z]{3,9})\.?\s+(\d{1,2})\s*,?\s+(\d{4})\s*,?\s*(\d{1,2}):(\d{2})/g;
            const dateEntries = [];
            let dm;
            while ((dm = numDateRe.exec(ajaxHtml)) !== null) {
                dateEntries.push({ pos: dm.index, y: parseInt(dm[3], 10), mo: parseInt(dm[2], 10) - 1, d: parseInt(dm[1], 10), h: parseInt(dm[4], 10), min: parseInt(dm[5], 10) });
            }
            while ((dm = namedDateRe.exec(ajaxHtml)) !== null) {
                const mi = parseClashMonth(dm[1]);
                if (mi === null) continue;
                dateEntries.push({ pos: dm.index, y: parseInt(dm[3], 10), mo: mi, d: parseInt(dm[2], 10), h: parseInt(dm[4], 10), min: parseInt(dm[5], 10) });
            }
            const labelRe = /(?:Jornada|Round|Ronda)\s+(\d+)/g;
            let lm;
            while ((lm = labelRe.exec(ajaxHtml)) !== null) {
                const round = parseInt(lm[1], 10);
                const after = dateEntries
                    .filter(e => e.pos > lm.index && e.pos - lm.index < 200)
                    .sort((a, b) => a.pos - b.pos)[0];
                if (!after) continue;
                const y = after.y;
                if (y < currentYear - 1 || y > currentYear + 2) continue;
                const ts = new Date(y, after.mo, after.d, after.h, after.min, 0, 0).getTime();
                if (!rounds.find(r => r.ts === ts)) {
                    rounds.push({ ts, round });
                }
            }
            if (rounds.length === 0) {
                console.log('ZOE AutoRun: nenhuma jornada (formato de datas não reconhecido)');
                const plain = ajaxHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 1500);
                console.log('ZOE AutoRun: [DEBUG] início do calendário:', plain);
                return null;
            }
            rounds.sort((a, b) => a.ts - b.ts);
            const next = findTargetRound(rounds, now);
            console.log('ZOE AutoRun: próxima jornada: #' + next.round, new Date(next.ts).toLocaleString());

            let rivalId = null, cid = null, rivalName = '';
            const roundLabel = 'Jornada ' + next.round;
            const roundIdx = ajaxHtml.indexOf(roundLabel);
            console.log('ZOE AutoRun: a procurar roundLabel =', roundLabel, 'encontrado em índice =', roundIdx);

            if (roundIdx >= 0) {
                const nextRoundLabel = 'Jornada ' + (next.round + 1);
                let contextEnd = ajaxHtml.indexOf(nextRoundLabel, roundIdx);
                if (contextEnd < 0) contextEnd = Math.min(ajaxHtml.length, roundIdx + 5000);
                const context = ajaxHtml.substring(roundIdx, contextEnd);
                console.log('ZOE AutoRun: contexto da jornada (primeiros 500 chars):', context.substring(0, 500));

                const rows = context.split('<tr').filter(r => r.includes('fid=' + ourFedId));
                console.log('ZOE AutoRun: linhas com fid=' + ourFedId + ' encontradas:', rows.length);

                for (const row of rows) {
                    console.log('ZOE AutoRun: a analisar linha (primeiros 300 chars):', row.substring(0, 300));

                    // Extrair todos os fid= da linha
                    const fidM = row.match(/fid=(\d+)/gi);
                    console.log('ZOE AutoRun: todos os fid encontrados na linha:', fidM);

                    if (fidM && fidM.length > 0) {
                        const fids = fidM.map(f => f.split('=')[1]);
                        console.log('ZOE AutoRun: fids extraídos:', fids);

                        // O rival é o fid que não é o nosso
                        const rival = fids.find(f => f !== ourFedId);
                        if (rival) {
                            rivalId = rival;
                            console.log('ZOE AutoRun: rivalId definido =', rivalId);

                            // Tentar extrair o nome do rival (prioridade: title attribute, depois conteúdo)
                            // O title pode vir antes ou depois do fid, por isso busca qualquer ordem
                            const aTitleMatch = row.match(new RegExp('<a[^>]*fid=' + rivalId + '[^>]*title="([^"]+)"[^>]*>', 'i'));
                            const aTitleMatchReverse = row.match(new RegExp('<a[^>]*title="([^"]+)"[^>]*fid=' + rivalId + '[^>]*>', 'i'));
                            if (aTitleMatch) {
                                rivalName = aTitleMatch[1].trim();
                            } else if (aTitleMatchReverse) {
                                rivalName = aTitleMatchReverse[1].trim();
                            } else {
                                const aContentMatch = row.match(new RegExp('<a[^>]*fid=' + rivalId + '[^>]*>([\\s\\S]*?)</a>'));
                                if (aContentMatch) rivalName = aContentMatch[1].replace(/<[^>]*>/g, '').trim();
                            }

                            // Extrair cid se existir
                            const cidM = row.match(/sub=clash[&?]cid=(\d+)/);
                            if (cidM) cid = cidM[1];

                            break;
                        }
                    }
                }
                if (!cid) {
                    const ourPos = context.indexOf('fid=' + ourFedId);
                    if (ourPos >= 0) {
                        const ourContext = context.substring(ourPos, ourPos + 500);
                        const cidM = ourContext.match(/sub=clash[&?]cid=(\d+)/);
                        if (cidM) cid = cidM[1];
                    }
                }
            }
            console.log('ZOE AutoRun: extração do AJAX: rivalId =', rivalId, 'cid =', cid, 'rivalName =', rivalName);

            // Se temos um cid, buscar página Clash específica para extrair a divisão
            if (cid && !division) {
                console.log('ZOE AutoRun: a buscar página Clash específica para divisão, cid =', cid);
                const clashPageUrl = 'https://www.managerzone.com/?p=federations&sub=clash&cid=' + cid + '&changesport=' + sport + '&_nocache=' + Date.now();
                const clashPageHtml = await new Promise((resolve) => {
                    GM_xmlhttpRequest({
                        method: 'GET', url: clashPageUrl, timeout: 15000,
                        onload: (r) => resolve(r.responseText || ''),
                        onerror: () => resolve(''), ontimeout: () => resolve('')
                    });
                });
                console.log('ZOE AutoRun: Clash page HTML length:', clashPageHtml.length);
                if (clashPageHtml) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(clashPageHtml, 'text/html');
                    const seasonPane = doc.querySelector('.top-pane__season');
                    const divisionLink = seasonPane?.querySelector('a[title*="ivis"], a[title*="ivisão"], a[title*="ivisión"], a[title*="ivision"]');
                    if (divisionLink) {
                        const titleText = divisionLink.getAttribute('title') || divisionLink.textContent || '';
                        const divNumMatch = titleText.match(/([\d.]+)\s*$/);
                        if (divNumMatch) division = divNumMatch[1];
                        else division = titleText.trim();
                        console.log('ZOE AutoRun: divisão extraída da página Clash =', division);
                    }
                }
            }

            // Se não conseguiu obter rival/cid do AJAX e temos um cid do contexto, buscar página específica
            if ((!rivalId || !cid) && ourFedId) {
                console.log('ZOE AutoRun: extração do AJAX falhou, a buscar página geral do Clash da federação');
                const clashUrl = 'https://www.managerzone.com/?p=federations&sub=clash&changesport=' + sport + '&_nocache=' + Date.now();
                const clashHtml = await new Promise((resolve) => {
                    GM_xmlhttpRequest({
                        method: 'GET', url: clashUrl, timeout: 15000,
                        headers: { 'Referer': 'https://www.managerzone.com/?p=federations&sub=clash&changesport=' + sport },
                        onload: (r) => resolve(r.responseText || ''),
                        onerror: () => resolve(''), ontimeout: () => resolve('')
                    });
                });
                if (clashHtml && clashHtml.length > 200) {
                    const rival = extractRivalFedId(ourFedId, clashHtml);
                    if (rival) {
                        rivalId = rival;
                        console.log('ZOE AutoRun: rival obtido da página geral do Clash =', rivalId);
                    }
                }
            }

            const result = { round: next.round, ts: next.ts, season, division, lev: ajaxLevel, dvi: ajaxDiv, rivalId, cid, rivalName, allRounds: rounds, _timestamp: Date.now() };
            console.log('ZOE AutoRun: dados da jornada:', result);
            GM_setValue(cacheKey, JSON.stringify(result));
            console.log('ZOE AutoRun: calendário guardado em cache');
            return result;
        } catch(e) {
            if (cached) {
                console.log('ZOE AutoRun: erro ao buscar, a usar cache como fallback');
                return cached;
            }
            console.log('ZOE AutoRun: erro ao buscar calendário:', e.message || e);
            return null;
        }
    }

    function getNextRoundFromList(rounds, currentRound) {
        if (!rounds || rounds.length === 0) return null;
        const idx = rounds.findIndex(r => r.round === currentRound);
        if (idx >= 0 && idx < rounds.length - 1) return rounds[idx + 1];
        return null;
    }

    function ensureStatusCorner() {
        let corner = document.getElementById('zoe-status-corner');
        if (!corner) {
            corner = document.createElement('div');
            corner.id = 'zoe-status-corner';
            corner.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:999999;display:flex;flex-direction:column;align-items:flex-end;gap:4px;font-family:Arial,sans-serif;font-size:11px';
            document.body.appendChild(corner);
        }
        return corner;
    }

    function ensureAutoRunStatusEl(sport) {
        if (window._zoeAutoRunStatusEl && window._zoeAutoRunStatusEl.parentNode) {
            return window._zoeAutoRunStatusEl;
        }
        const el = document.createElement('div');
        el.id = 'zoe-autorun-status';
        el.style.cssText = 'padding:6px 12px;background:#1a1a2e;color:#4caf50;border:1px solid #4caf50;border-radius:6px;white-space:nowrap';
        el.title = t('autorunStatusTitle');
        ensureStatusCorner().appendChild(el);
        window._zoeAutoRunStatusEl = el;
        return el;
    }

    async function scheduleAutoRun(sport, skipRound) {
        const settings = getClashSettings(sport);
        if (!settings.autoRun || settings.autoRunBefore === 'none') {
            console.log('ZOE AutoRun: desativado');
            if (window._zoeAutoRunTimer) { clearTimeout(window._zoeAutoRunTimer); window._zoeAutoRunTimer = null; }
            if (window.location.search.includes('p=federations')) {
                ensureAutoRunStatusEl(sport).textContent = t('autorunInactive');
                ensureAutoRunStatusEl(sport).style.color = '#f44336';
                ensureAutoRunStatusEl(sport).style.borderColor = '#f44336';
            }
            return;
        }
        const offsetHours = parseInt(settings.autoRunBefore, 10) || 0;
        const offsetMs = offsetHours * 3600000;
        let nextRound = await fetchNextRoundData(sport);
        if (!nextRound) {
            console.log('ZOE AutoRun: não foi possível obter data, desativar');
            return;
        }
        if (skipRound && nextRound.round === skipRound) {
            console.log('ZOE AutoRun: jornada #' + nextRound.round + ' ja foi processada, a aguardar próxima...');
            // Find actual next round from schedule data
            const allR = nextRound.allRounds || [];
            const skipIdx = allR.findIndex(r => r.round === skipRound);
            let nextMs = null;
            if (skipIdx >= 0 && skipIdx < allR.length - 1) {
                const fol = allR[skipIdx + 1];
                nextMs = fol.ts - offsetMs;
                console.log('ZOE AutoRun: próxima jornada real: #' + fol.round + ' ' + new Date(fol.ts).toLocaleString());
            } else {
                nextMs = nextRound.ts + (7 * 86400000) - (offsetMs || 86400000);
                console.log('ZOE AutoRun: a usar fallback +7 dias para próxima jornada');
            }
            const delay2 = nextMs - Date.now();
            if (delay2 > 60000) {
                const fmt2 = (ms) => { const h = Math.floor(ms / 3600000); const min = Math.floor((ms % 3600000) / 60000); return h + ':' + String(min).padStart(2, '0') + 'h'; };
                console.log('ZOE AutoRun: reagendado para daqui ' + fmt2(delay2));
                if (window._zoeAutoRunTimer) clearTimeout(window._zoeAutoRunTimer);
                window._zoeAutoRunTimer = setTimeout(() => { startClashScreenshotFlow(true); }, delay2);
                if (window.location.search.includes('p=federations')) {
                    const el = ensureAutoRunStatusEl(sport);
                    el.textContent = 'AutoRun: ' + fmt2(delay2) + t('autorunUntilExecution');
                    el.style.color = '#4caf50';
                    el.style.borderColor = '#4caf50';
                }
            }
            return;
        }
        const nextRoundMs = nextRound.ts;
        const nowMs = Date.now();

        // Janela de 24h após o início da jornada
        const winStart = new Date(nextRoundMs);
        winStart.setHours(0, 0, 0, 0);
        const winStartMs = winStart.getTime();
        const winEnd = new Date(nextRoundMs);
        winEnd.setHours(winEnd.getHours() + 24, winEnd.getMinutes(), 0, 0); // 24h após o início
        const winEndMs = winEnd.getTime();
        const inWindow = nowMs >= winStartMs && nowMs <= winEndMs;

        let triggerMs = nextRoundMs - offsetMs;
        let forceRun = false;
        if (triggerMs <= nowMs) {
            if (nextRoundMs > nowMs) {
                if (!skipRound) {
                    console.log('ZOE AutoRun: janela do offset já passou mas a jornada ainda não começou, a executar...');
                    const ourId = getOurFedId();
                    if (ourId) {
                        const existing = await checkExistingClashPost(sport, ourId, nextRound);
                        if (existing) {
                            console.log('ZOE AutoRun: jornada #' + existing + ' ja tem post, reagendar silenciosamente...');
                            await scheduleAutoRun(sport, existing);
                            return;
                        }
                    }
                    triggerMs = nowMs;
                    forceRun = true;
                } else {
                    console.log('ZOE AutoRun: jornada #' + nextRound.round + ' na janela, a aguardar proxima...');
                    const nextAfter1 = getNextRoundFromList(nextRound.allRounds, nextRound.round);
                    triggerMs = nextAfter1 ? nextAfter1.ts - offsetMs : nextRoundMs + (7 * 86400000) - offsetMs;
                }
            } else if (inWindow) {
                console.log('ZOE AutoRun: jornada já começou mas ainda dentro da janela de 2 dias, a executar...');
                const ourId = getOurFedId();
                if (ourId) {
                    const existing = await checkExistingClashPost(sport, ourId, nextRound);
                    if (existing) {
                        console.log('ZOE AutoRun: jornada #' + existing + ' ja tem post, reagendar silenciosamente...');
                        await scheduleAutoRun(sport, existing);
                        return;
                    }
                }
                triggerMs = nowMs;
                forceRun = true;
            } else {
                console.log('ZOE AutoRun: fora da janela de 2 dias, a aguardar próxima...');
                const nextAfter2 = getNextRoundFromList(nextRound.allRounds, nextRound.round);
                triggerMs = nextAfter2 ? nextAfter2.ts - offsetMs : nextRoundMs + (7 * 86400000) - offsetMs;
            }
        }
        const delay = triggerMs - nowMs;
        if (delay < 60000 && !forceRun) {
            console.log('ZOE AutoRun: menos de 1 minuto, ignorar');
            return;
        }
        const fmt = (ms) => { const h = Math.floor(ms / 3600000); const min = Math.floor((ms % 3600000) / 60000); return h + ':' + String(min).padStart(2, '0') + 'h'; };
        if (!forceRun) console.log('ZOE AutoRun: agendado para', new Date(triggerMs).toLocaleString(), '(daqui ' + fmt(delay) + ')');
        if (window._zoeAutoRunTimer) clearTimeout(window._zoeAutoRunTimer);
        if (forceRun) {
            console.log('ZOE AutoRun: a executar fluxo automático...');
            startClashScreenshotFlow(true);
            return;
        }
        window._zoeAutoRunTimer = setTimeout(() => {
            console.log('ZOE AutoRun: a executar fluxo automático...');
            startClashScreenshotFlow(true);
        }, delay);
        if (window.location.search.includes('p=federations')) {
            const el = ensureAutoRunStatusEl(sport);
            el.textContent = 'AutoRun: ' + fmt(delay) + t('autorunUntilExecution');
            el.style.color = '#4caf50';
            el.style.borderColor = '#4caf50';
        }
    }

    // --- Auto-Mensagem (independente do AutoRun) ---

    function getAutoMsgSentState(sport) {
        try {
            const raw = GM_getValue('zoe_automessage_sent_' + sport, 'null');
            const v = JSON.parse(raw);
            return v && typeof v === 'object' && v.round !== undefined ? { round: v.round, ts: v.ts || 0 } : null;
        } catch(e) { return null; }
    }
    function saveAutoMsgSentState(sport, round) {
        GM_setValue('zoe_automessage_sent_' + sport, JSON.stringify({ round: round, ts: Date.now() }));
    }
    function getAutoMsgSentManagers(sport, round) {
        try {
            const raw = GM_getValue('zoe_automessage_sentmanagers_' + sport, 'null');
            const v = JSON.parse(raw);
            return v && v.round === round && Array.isArray(v.uids) ? v.uids : [];
        } catch(e) { return []; }
    }
    function markAutoMsgManagerSent(sport, round, uid) {
        const uids = getAutoMsgSentManagers(sport, round);
        if (uids.indexOf(uid) < 0) uids.push(uid);
        GM_setValue('zoe_automessage_sentmanagers_' + sport, JSON.stringify({ round: round, uids: uids }));
    }
    function getAutoMsgSkipRound(sport) {
        try {
            const raw = GM_getValue('zoe_automessage_skip_' + sport, 'null');
            const v = JSON.parse(raw);
            if (!v || v.round === undefined) return null;
            // compatibilidade: gravações antigas só tinham { round, ts } onde ts era a data do cancelamento
            if (v.roundTs === undefined && v.ts) v.roundTs = v.ts;
            return v;
        } catch(e) { return null; }
    }
    function saveAutoMsgSkipRound(sport, round, roundTs) {
        GM_setValue('zoe_automessage_skip_' + sport, JSON.stringify({ round: round, roundTs: roundTs || 0, ts: Date.now() }));
        console.log('ZOE AutoMsg: jornada #' + round + ' marcada como cancelada (não volta a disparar nesta jornada)');
    }
    function clearAutoMsgState(sport) {
        GM_setValue('zoe_automessage_sent_' + sport, 'null');
        GM_setValue('zoe_automessage_sentmanagers_' + sport, 'null');
        GM_setValue('zoe_automessage_defer_' + sport, 'null');
        GM_setValue('zoe_automessage_skip_' + sport, 'null');
        console.log('ZOE AutoMsg: estado limpo para o desporto "' + sport + '"');
    }
    unsafeWindow.zoeClearAutoMsgSent = function(sport) {
        clearAutoMsgState(sport || 'soccer');
        return 'ZOE AutoMsg: estado limpo';
    };
    function getAutoMsgDeferUntil(sport, round) {
        try {
            const raw = GM_getValue('zoe_automessage_defer_' + sport, 'null');
            const v = JSON.parse(raw);
            if (v && v.round === round && v.until && v.until > Date.now()) return v.until;
        } catch(e) {}
        return 0;
    }
    function saveAutoMsgDefer(sport, round, until) {
        GM_setValue('zoe_automessage_defer_' + sport, JSON.stringify({ round: round, until: until }));
    }

    // --- Estado do Chat (mensagens por manager, independente da Auto-Mensagem) ---

    function getChatSentState(sport) {
        try {
            const raw = GM_getValue('zoe_chat_sent_' + sport, 'null');
            const v = JSON.parse(raw);
            return v && typeof v === 'object' && v.round !== undefined ? { round: v.round, ts: v.ts || 0 } : null;
        } catch(e) { return null; }
    }
    function saveChatSentState(sport, round) {
        GM_setValue('zoe_chat_sent_' + sport, JSON.stringify({ round: round, ts: Date.now() }));
    }
    function getChatSentManagers(sport, round) {
        try {
            const raw = GM_getValue('zoe_chat_sentmanagers_' + sport, 'null');
            const v = JSON.parse(raw);
            return v && v.round === round && Array.isArray(v.uids) ? v.uids : [];
        } catch(e) { return []; }
    }
    function markChatManagerSent(sport, round, uid) {
        const uids = getChatSentManagers(sport, round);
        if (uids.indexOf(uid) < 0) uids.push(uid);
        GM_setValue('zoe_chat_sentmanagers_' + sport, JSON.stringify({ round: round, uids: uids }));
    }
    // exclusões de managers do Chat (uid -> motivo), persistidas entre jornadas
    function getChatExclusions(sport) {
        try {
            const raw = GM_getValue('zoe_chat_excluded_' + sport, 'null');
            const v = JSON.parse(raw);
            return v && typeof v === 'object' ? v : {};
        } catch(e) { return {};
        }
    }
    function saveChatExclusion(sport, uid, reason) {
        const ex = getChatExclusions(sport);
        ex[uid] = String(reason || '').trim();
        GM_setValue('zoe_chat_excluded_' + sport, JSON.stringify(ex));
    }
    function removeChatExclusion(sport, uid) {
        const ex = getChatExclusions(sport);
        if (ex[uid] !== undefined) {
            delete ex[uid];
            GM_setValue('zoe_chat_excluded_' + sport, JSON.stringify(ex));
        }
    }
    function clearChatState(sport) {
        GM_setValue('zoe_chat_sent_' + sport, 'null');
        GM_setValue('zoe_chat_sentmanagers_' + sport, 'null');
        console.log('ZOE Chat: estado limpo para o desporto "' + sport + '"');
    }
    unsafeWindow.zoeClearChatSent = function(sport) {
        clearChatState(sport || 'soccer');
        return 'ZOE Chat: estado limpo';
    };

    async function fetchClashPageView(sport, fid, cid) {
        if (!fid) return null;
        let url = 'https://www.managerzone.com/?p=federations&sub=clash&fid=' + fid + '&changesport=' + sport;
        if (cid) url += '&cid=' + cid;
        url += '&_nocache=' + Date.now();
        let html;
        try {
            html = await new Promise(resolve => {
                GM_xmlhttpRequest({
                    method: 'GET', url,
                    timeout: 15000,
                    headers: { 'Referer': 'https://www.managerzone.com/?p=federations&sub=clash&cid=' + (cid || '') + '&changesport=' + sport },
                    onload: (r) => resolve(r.responseText || ''),
                    onerror: () => resolve(''), ontimeout: () => resolve('')
                });
            });
        } catch(e) { return null; }
        if (!html || html.length < 200) {
            console.warn('ZOE AutoMsg: resposta vazia/curta do Clash (fid=' + fid + (cid ? ', cid=' + cid : '') + ', length=' + (html ? html.length : 0) + ')');
            return null;
        }
        if (html.indexOf('challenges-list--challenge') < 0) {
            console.warn('ZOE AutoMsg: vista do Clash sem tabela de desafios no HTML estático (fid=' + fid + (cid ? ', cid=' + cid : '') + ', length=' + html.length + ')');
            // a tabela de desafios é carregada por AJAX; se estivermos na própria página
            // do Clash, o DOM renderizado já a tem — usar o DOM atual como fallback
            let domHtml = null;
            try {
                if (window.location.search.indexOf('sub=clash') >= 0) {
                    domHtml = document.documentElement.outerHTML;
                    if (domHtml && domHtml.indexOf('challenges-list--challenge') >= 0) {
                        console.log('ZOE AutoMsg: a usar DOM atual como fallback para a vista do Clash (fid=' + fid + ', length=' + domHtml.length + ')');
                        return domHtml;
                    }
                }
            } catch(e) {
                console.warn('ZOE AutoMsg: erro a usar DOM como fallback:', e.message);
            }
            const tPos = html.indexOf('class="team-name"');
            const uPos = html.indexOf('class="username"');
            const gPos = html.indexOf('flex-grow-1');
            const probe = tPos >= 0 ? tPos : (uPos >= 0 ? uPos : gPos);
            console.log('ZOE AutoMsg: [DEBUG] snippet do Clash (fid=' + fid + '):', probe >= 0 ? html.substring(Math.max(0, probe - 800), probe + 2000) : html.substring(0, 1500));
            return null;
        }
        console.log('ZOE AutoMsg: vista do Clash obtida (fid=' + fid + (cid ? ', cid=' + cid : '') + ', length=' + html.length + ')');
        return html;
    }

    // --- Deteção do deadline do fim da jornada atual (página do Clash) ---

    function parseClashMonth(s) {
        const map = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
            fev: 1, mai: 4, ago: 7, set: 8, out: 9, dez: 11,
            ene: 0, dic: 11
        };
        const k = String(s).toLowerCase().replace(/[^a-z]/g, '');
        return (map[k] !== undefined) ? map[k] : null;
    }

    function parseClashDeadlineEnd(html) {
        if (!html) return null;
        const dm = html.match(/top-pane__deadline[\s\S]*?>([\s\S]*?)<\/div>/i);
        if (!dm) return null;
        const text = dm[1].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        const dateRe = /([A-Za-z\u00C0-\u00FF]+)\s+(\d{1,2})\s+(\d{4}),\s*(\d{1,2}):(\d{2})/g;
        const found = [];
        let m;
        while ((m = dateRe.exec(text)) !== null) found.push(m);
        if (found.length < 2) {
            console.warn('ZOE AutoMsg: datas do deadline não encontradas no texto: "' + text + '"');
            return null;
        }
        // o fim da jornada é a 2ª data do intervalo "Início - Fim"
        const end = found[found.length - 1];
        const month = parseClashMonth(end[1]);
        if (month === null) {
            console.warn('ZOE AutoMsg: mês não reconhecido no deadline: ' + end[1]);
            return null;
        }
        return new Date(parseInt(end[3], 10), month, parseInt(end[2], 10), parseInt(end[4], 10), parseInt(end[5], 10)).getTime();
    }

    async function fetchClashDeadlineEnd(sport) {
        let ourId = getOurFedId();
        if (!ourId) ourId = extractOurFedIdFromSelectVal();
        if (!ourId) {
            const m = window.location.search.match(/[?&]fid=(\d+)/);
            if (m) ourId = m[1];
        }
        if (!ourId) {
            console.log('ZOE AutoMsg: sem fed ID para obter o deadline do Clash');
            return null;
        }
        if (window._zoeClashDeadlineCache && window._zoeClashDeadlineCache.sport === sport && (Date.now() - window._zoeClashDeadlineCache.fetched) < 600000) {
            return window._zoeClashDeadlineCache.ts;
        }
        const url = 'https://www.managerzone.com/?p=federations&sub=clash&fid=' + ourId + '&changesport=' + sport + '&_nocache=' + Date.now();
        let html;
        try {
            html = await new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET', url,
                    timeout: 15000,
                    headers: { 'Referer': 'https://www.managerzone.com/?p=federations&sub=clash&fid=' + ourId + '&changesport=' + sport },
                    onload: (r) => resolve(r.responseText || ''),
                    onerror: () => resolve(''), ontimeout: () => resolve('')
                });
            });
        } catch(e) { return null; }
        if (!html || html.length < 200) {
            console.warn('ZOE AutoMsg: resposta vazia/curta do Clash (deadline), length=' + (html ? html.length : 0));
            return null;
        }
        const ts = parseClashDeadlineEnd(html);
        if (ts) {
            window._zoeClashDeadlineCache = { sport: sport, ts: ts, fetched: Date.now() };
        }
        console.log('ZOE AutoMsg: deadline do fim da jornada (do Clash):', ts ? new Date(ts).toLocaleString() : 'não detetado');
        return ts;
    }

    function parseClashViewOwnMembers(html) {
        // na vista 'Desafios adversários' (fid = rival), o 1º div de cada tr
        // com a classe 'flex-nowrap challenges-list--challenge' contém os nossos membros.
        // Só é Membro Principal se o símbolo aparecer ANTES do nome do nosso manager;
        // símbolos de managers adversários (que aparecem depois do nome) não contam.
        const members = [];
        const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        const badgeRe = /superuser-icon|fa-universal-access/i;
        const nameLinkRe = /<a[^>]*class="username"[^>]*>/i;
        let rm;
        while ((rm = rowRe.exec(html)) !== null) {
            const row = rm[1];
            const ci = row.indexOf('challenges-list--challenge');
            if (ci < 0) continue;
            const chunk = row.substring(ci);
            const uidMatch = chunk.match(/href="[^"]*p=profile(?:&amp;|&)uid=(\d+)[^"]*"/i);
            const nameMatch = chunk.match(/<a[^>]*class="username"[^>]*>([\s\S]*?)<\/a>/i);
            if (!uidMatch || !nameMatch) continue;
            const uid = uidMatch[1];
            const name = nameMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            if (!uid || !name) continue;
            if (members.find(x => x.uid === uid)) continue;
            // o nome da equipa está logo a seguir ao username (mesmo flex-grow-1)
            const chunkAfterUser = chunk.substring(nameMatch.index + nameMatch[0].length);
            const teamMatch = chunkAfterUser.match(/<a[^>]*class="team-name"[^>]*>([\s\S]*?)<\/a>/i);
            const team = teamMatch ? teamMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';
            // o primeiro link de username é o do nosso manager (no 1º div);
            // o badge só conta se aparecer antes desse nome
            const nm = nameLinkRe.exec(chunk);
            const isMain = nm ? badgeRe.test(chunk.substring(0, nm.index)) : false;
            members.push({ uid: uid, name: name, team: team, isMain: isMain, played: false });
        }
        return members;
    }

    function parseClashViewPlayedCounts(html) {
        // na vista 'Nossos desafios' (fid = nosso), o 2º div ('.challenges')
        // de cada tr contém os nomes dos nossos membros que já jogaram
        const counts = {};
        const nameRe = /<div[^>]*class="[^"]*challenges--name[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
        let m;
        while ((m = nameRe.exec(html)) !== null) {
            const inner = m[1];
            const userMatch = inner.match(/<(?:span|a|b)[^>]*class="[^"]*username[^"]*"[^>]*>([\s\S]*?)<\/(?:span|a|b)>/i);
            let name = userMatch ? userMatch[1] : inner;
            name = name.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
            if (!name) continue;
            counts[name] = (counts[name] || 0) + 1;
        }
        return counts;
    }

    function deriveClashFedIds(nextRound) {
        let ourId = getOurFedId();
        if (!ourId) ourId = extractOurFedIdFromSelectVal();
        if (!ourId) {
            const urlMatch = window.location.search.match(/[?&]fid=(\d+)/);
            if (urlMatch) ourId = urlMatch[1];
        }
        // o cid só é válido na própria página do Clash (sub=clash);
        // em qualquer outra página (ex.: ?p=federations) deteta-se o clash ATUAL
        const isClashPage = /sub=clash/.test(window.location.search);
        const urlCidMatch = isClashPage ? window.location.search.match(/[?&]cid=(\d+)/) : null;
        const cid = urlCidMatch ? urlCidMatch[1] : null;
        let rivalId = null;
        if (!rivalId && nextRound && nextRound.rivalId) rivalId = String(nextRound.rivalId);
        if (!ourId || !rivalId) {
            const values = [];
            const opts = document.querySelectorAll('#federation-select option');
            for (const o of opts) {
                const v = (o.value || '').trim();
                if (/^\d+$/.test(v)) values.push(v);
            }
            if (!ourId && values.length > 0) ourId = values[0];
            if (!rivalId && ourId) {
                const found = values.find(v => v !== ourId);
                if (found) rivalId = found;
            }
        }
                return { ourId: ourId ? String(ourId) : null, rivalId: rivalId ? String(rivalId) : null, cid: cid };
    }

    function parseClashViewOurMembersFromNames(html) {
        // Na página do Clash com cid, challenges-list--challenge contém sempre
        // o membro adversário, e challenges--name contém o nosso membro.
        // Este parser extrai os nossos membros a partir dos divs challenges--name.
        const members = [];
        if (!html) return members;
        const badgeRe = /superuser-icon|fa-universal-access/i;
        const nameRe = /<div[^>]*class="[^"]*challenges--name[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
        let m;
        while ((m = nameRe.exec(html)) !== null) {
            const inner = m[1];
            const userMatch = inner.match(/<(?:span|a|b)[^>]*class="[^"]*username[^"]*"[^>]*>([\s\S]*?)<\/(?:span|a|b)>/i);
            let name = userMatch ? userMatch[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : '';
            if (!name) {
                name = inner.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
            }
            if (!name) continue;
            const uidMatch = inner.match(/href="[^"]*p=profile(?:&amp;|&)uid=(\d+)[^"]*"/i);
            const uid = uidMatch ? uidMatch[1] : '';
            if (uid && members.find(x => x.uid === uid)) continue;
            if (!uid && members.find(x => x.name === name)) continue;
            const teamMatch = inner.match(/<a[^>]*class="team-name"[^>]*>([\s\S]*?)<\/a>/i);
            const team = teamMatch ? teamMatch[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : '';
            const usernameIdx = inner.indexOf('username');
            const isMain = usernameIdx >= 0 && badgeRe.test(inner.substring(0, usernameIdx));
            members.push({ uid: uid, name: name, team: team, isMain: isMain, played: false });
        }
        return members;
    }

    async function fetchClashMissingManagers(sport, nextRound) {
        let ids = deriveClashFedIds(nextRound);
        let ourId = ids.ourId, rivalId = ids.rivalId, cid = ids.cid;
        let currentOurHtml = null;
        if (!rivalId && ourId) {
            // fora da página do Clash (ex.: ?p=federations): obter o clash ATUAL de sub=clash
            currentOurHtml = await fetchClashPageView(sport, ourId, null);
            if (currentOurHtml) {
                const rival = extractRivalFedId(ourId, currentOurHtml);
                if (rival) {
                    rivalId = rival;
                    if (!cid) {
                        const cidM = currentOurHtml.match(/sub=clash[&?]cid=(\d+)/);
                        if (cidM) cid = cidM[1];
                    }
                }
            }
        }
                console.log('ZOE AutoMsg: IDs deteção do Clash — ourId=' + ourId + ', rivalId=' + rivalId + (cid ? ', cid=' + cid : ''));
        if (!ourId || !rivalId) {
            console.warn('ZOE AutoMsg: sem IDs suficientes para detetar na página do Clash (ourId=' + ourId + ', rivalId=' + rivalId + ')');
            return null;
        }
        // Buscar os nossos membros da página da federação (?p=federations),
        // que contém a tabela #federation_clash_members_list com uid, nome, equipa, isMain.
        // Depois buscar o HTML do Clash para verificar quem já jogou (challenges--name).
        const fedUrl = 'https://www.managerzone.com/?p=federations&changesport=' + sport + '&_nocache=' + Date.now();
        const fedHtml = await new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET', url: fedUrl, timeout: 15000,
                headers: { 'Referer': 'https://www.managerzone.com/?p=federations&changesport=' + sport },
                onload: (r) => resolve(r.responseText || ''),
                onerror: () => resolve(''), ontimeout: () => resolve('')
            });
        });
        let ourMembers = [];
        try {
            const titleMatch = fedHtml ? fedHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i) : null;
            console.log('ZOE AutoMsg: ?p=federations length=' + (fedHtml ? fedHtml.length : 0) + ' | hasTable=' + (fedHtml ? /id="federation_clash_members_list"/i.test(fedHtml) : false) + ' | data-user-id=' + (fedHtml ? (fedHtml.match(/data-user-id="/g) || []).length : 0) + ' | title=' + (titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 120) : ''));
        } catch(e) {}
        if (fedHtml && fedHtml.length > 200) {
            ourMembers = parseFederationMembersList(fedHtml);
            console.log('ZOE AutoMsg: membros da federação (?p=federations) = ' + ourMembers.length);
        } else {
            console.warn('ZOE AutoMsg: resposta vazia/curta de ?p=federations (' + (fedHtml ? fedHtml.length : 0) + ' bytes)');
        }
        // Se não encontrou membros na tabela da federação, fallback: extrair de challenges--name no Clash
        if (!ourMembers.length) {
            console.log('ZOE AutoMsg: fallback — a extrair membros de challenges--name no Clash...');
            let clashHtml = currentOurHtml;
            if (!clashHtml) {
                clashHtml = await fetchClashPageView(sport, ourId, cid);
            }
            if (clashHtml) {
                ourMembers = parseClashViewOurMembersFromNames(clashHtml);
                console.log('ZOE AutoMsg: membros via challenges--name = ' + ourMembers.length);
            }
        }
        if (!ourMembers.length) {
            console.warn('ZOE AutoMsg: nenhum membro encontrado | fedHtmlLen=' + (fedHtml ? fedHtml.length : 0) + ' | fedTable=' + (fedHtml ? /id="federation_clash_members_list"/i.test(fedHtml) : false) + ' | clashHtmlLen=' + (currentOurHtml ? currentOurHtml.length : 0));
            let fedSnippet = '';
            try { fedSnippet = (fedHtml || '').replace(/\s+/g, ' ').slice(0, 1000); } catch(e) {}
            console.warn('ZOE AutoMsg: snippet ?p=federations: ' + fedSnippet);
            return null;
        }
        // Buscar o HTML do Clash para verificar quem já jogou
        let clashHtml = currentOurHtml;
        if (!clashHtml) {
            clashHtml = await fetchClashPageView(sport, ourId, cid);
        }
        if (!clashHtml) {
            console.warn('ZOE AutoMsg: não foi possível carregar a página do Clash');
            return null;
        }
        const playedCounts = parseClashViewPlayedCounts(clashHtml);
        console.log('ZOE AutoMsg: membros →', ourMembers.map(m => m.name + ' (' + m.team + ')' + (m.isMain ? ' [MAIN]' : '')));
        console.log('ZOE AutoMsg: contagens challenges--name →', playedCounts);
        for (const m of ourMembers) {
            const needed = m.isMain ? 2 : 1;
            m.played = (playedCounts[m.name] || 0) >= needed;
        }
        const missing = ourMembers.filter(m => !m.played);
        console.log('ZOE AutoMsg: membros = ' + ourMembers.length + ', em falta = ' + missing.length, missing.map(m => m.name));
        return { all: ourMembers, missing: missing };
    }

    // --- Deteção de managers para o Chat (mensagens por manager) ---

    function parseFederationMembersList(html) {
        const members = [];
        if (!html) return members;
        const tableRe = /<table[^>]*id="federation_clash_members_list"[^>]*>([\s\S]*?)<\/table>/i;
        const tm = html.match(tableRe);
        if (!tm) {
            console.warn('ZOE AutoMsg: parseFederationMembersList — tabela #federation_clash_members_list não encontrada');
            return members;
        }
        const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let rm;
        let rowCount = 0, skippedNoUid = 0, skippedNoName = 0, skippedDup = 0;
        while ((rm = trRe.exec(tm[1])) !== null) {
            rowCount++;
            const row = rm[1];
            const uidMatch = row.match(/data-user-id="(\d+)"/);
            if (!uidMatch) { skippedNoUid++; continue; }
            const nameMatch = row.match(/<a[^>]*href="[^"]*p=profile[^"]*uid=\d+[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
            const name = nameMatch ? nameMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';
            if (!name) { skippedNoName++; continue; }
            if (members.find(x => x.uid === uidMatch[1])) { skippedDup++; continue; }
            // o badge de membro principal conta apenas se aparecer antes do link do nome
            const nm = row.indexOf('<a');
            const isMain = nm >= 0 && /superuser-icon|fa-universal-access/i.test(row.substring(0, nm));
            const teamMatch = row.match(/<a[^>]*class="team-name"[^>]*>([\s\S]*?)<\/a>/i);
            const team = teamMatch ? teamMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';
            members.push({ uid: uidMatch[1], name: name, team: team, isMain: isMain, played: false });
        }
        if (rowCount && !members.length) {
            console.warn('ZOE AutoMsg: parseFederationMembersList — rows=' + rowCount + ' | semUid=' + skippedNoUid + ' | semNome=' + skippedNoName + ' | duplicados=' + skippedDup);
        }
        return members;
    }

    async function fetchChatTargetManagers(sport, nextRound) {
        // deteção idêntica à Auto-Mensagem: ?p=federations&sub=clash (sem &prev=)
        // com a nossa federação e a rival; se nenhuma equipa for detetada,
        // fallback para ?p=federations e a tabela #federation_clash_members_list
        const t0 = Date.now();
        console.log('ZOE Chat: fetchChatTargetManagers START | sport=' + sport + ' | nextRound=' + (nextRound ? nextRound.round : 'null') + ' | visibility=' + document.visibilityState);
        let members = null;
        try {
            const tc = Date.now();
            const clash = await fetchClashMissingManagers(sport, nextRound);
            console.log('ZOE Chat: fetchClashMissingManagers em ' + (Date.now() - tc) + 'ms → all=' + (clash && clash.all ? clash.all.length : 0) + ' | missing=' + (clash && clash.missing ? clash.missing.length : 0) + (clash && clash.all ? ' | ' + JSON.stringify(clash.all.slice(0, 20).map(m => ({ uid: m.uid, name: m.name, team: m.team, isMain: !!m.isMain, played: !!m.played }))) : ''));
            if (clash && clash.all && clash.all.length) {
                members = clash.all;
                console.log('ZOE Chat: managers detetados via sub=clash = ' + members.length);
            } else {
                console.log('ZOE Chat: sub=clash não devolveu membros (all=' + (clash && clash.all ? clash.all.length : 0) + ', missing=' + (clash && clash.missing ? clash.missing.length : 0) + ')');
            }
        } catch(e) {
            console.warn('ZOE Chat: erro na deteção via sub=clash: ' + (e && e.stack ? e.stack : e));
        }
        if (!members || !members.length) {
            console.log('ZOE Chat: nenhuma equipa detetada em sub=clash, fallback para ?p=federations...');
            const url = 'https://www.managerzone.com/?p=federations&changesport=' + sport + '&_nocache=' + Date.now();
            console.log('ZOE Chat: fallback GET ' + url);
            const html = await new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET', url,
                    timeout: 15000,
                    headers: { 'Referer': 'https://www.managerzone.com/?p=federations&changesport=' + sport },
                    onload: (r) => resolve(r.responseText || ''),
                    onerror: () => resolve(''), ontimeout: () => resolve('')
                });
            });
            console.log('ZOE Chat: fallback resposta length=' + (html ? html.length : 0));
            if (!html || html.length < 200) {
                console.warn('ZOE Chat: resposta vazia/curta de ?p=federations (' + (html ? html.length : 0) + ' bytes)');
                return null;
            }
            let tableInfo = 'sem tabela';
            try {
                const hasTable = /id="federation_clash_members_list"/i.test(html);
                const uidCount = (html.match(/data-user-id="/g) || []).length;
                const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                tableInfo = 'hasTable=' + hasTable + ' | data-user-id=' + uidCount + ' | title=' + (titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 100) : '');
            } catch(e) {}
            members = parseFederationMembersList(html);
            console.log('ZOE Chat: managers detetados via ?p=federations = ' + members.length + ' | ' + tableInfo + ' | ' + JSON.stringify(members.slice(0, 20).map(m => ({ uid: m.uid, name: m.name, team: m.team, isMain: !!m.isMain }))));
            if (!members.length) {
                let snippet = '';
                try { snippet = html.replace(/\s+/g, ' ').slice(0, 800); } catch(e) {}
                console.warn('ZOE Chat: fallback sem membros | snippet=' + snippet);
                return null;
            }
        }
        console.log('ZOE Chat: fetchChatTargetManagers FIM em ' + (Date.now() - t0) + 'ms | total=' + members.length);
        return members;
    }

    let zoeMsgFrame = null;
    function getMsgFrame() {
        if (zoeMsgFrame && zoeMsgFrame.parentNode) {
            console.log('ZOE AutoMsg: a reutilizar iframe de mensagens | src=' + String(zoeMsgFrame.src || '').slice(0, 160));
            return zoeMsgFrame;
        }
        const f = document.createElement('iframe');
        f.id = 'zoe-amsg-frame';
        f.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1200px;height:800px;border:none;';
        document.body.appendChild(f);
        zoeMsgFrame = f;
        f.addEventListener('load', function() { hookFrameDiagnostics(f); });
        console.log('ZOE AutoMsg: iframe de mensagens criado | id=' + f.id);
        return f;
    }
    function hookFrameDiagnostics(frame) {
        try {
            const w = frame.contentWindow;
            const d = frame.contentDocument;
            if (!w || !d) return;
            if (d.__zoeFrameDiagHooked) return;
            d.__zoeFrameDiagHooked = true;
            try {
                w.addEventListener('error', function(ev) {
                    try {
                        const target = ev && ev.target;
                        const src = target && (target.src || target.href) ? ' | target=' + String(target.src || target.href).slice(0, 180) : '';
                        const stack = ev && ev.error && ev.error.stack ? ' | stack=' + String(ev.error.stack).slice(0, 1200) : '';
                        const loc = ev && ev.filename ? ' | ' + ev.filename + ':' + ev.lineno + ':' + ev.colno : '';
                        console.error('ZOE Frame JS error: ' + (ev && ev.message ? ev.message : 'resource error') + loc + src + stack);
                    } catch(e) {}
                }, true);
            } catch(e) {}
            try {
                w.addEventListener('unhandledrejection', function(ev) {
                    try {
                        const r = ev && ev.reason;
                        const text = r && r.stack ? r.stack : (r && r.message ? r.message : zoeFormatLogArg(r));
                        console.error('ZOE Frame unhandledrejection: ' + String(text).slice(0, 1200));
                    } catch(e) {}
                });
            } catch(e) {}
            ['error', 'warn'].forEach(function(level) {
                try {
                    const orig = w.console && w.console[level];
                    if (typeof orig !== 'function' || orig.__zoeFrameWrapped) return;
                    const wrapped = function() {
                        try {
                            const msg = Array.prototype.slice.call(arguments).map(zoeFormatLogArg).join(' ');
                            console[level]('ZOE Frame console.' + level + ': ' + msg);
                        } catch(e) {}
                        return orig.apply(w.console, arguments);
                    };
                    wrapped.__zoeFrameWrapped = true;
                    w.console[level] = wrapped;
                } catch(e) {}
            });
            console.log('ZOE Chat: hooks de diagnóstico do iframe instalados | url=' + String((w.location && w.location.href) || '').slice(0, 160));
        } catch(e) {
            console.warn('ZOE Chat: falha ao instalar hooks do iframe: ' + (e && e.message ? e.message : e));
        }
    }
    function loadInFrame(frame, url) {
        return new Promise(resolve => {
            const t0 = Date.now();
            let done = false;
            const finish = (reason) => {
                if (done) return;
                done = true;
                hookFrameDiagnostics(frame);
                console.log('ZOE Chat: loadInFrame ' + reason + ' em ' + (Date.now() - t0) + 'ms | url=' + String(url).slice(0, 160) + ' | ' + zoeChatFrameState(frame, null));
                resolve();
            };
            frame.onload = () => finish('onload');
            try { frame.src = url; } catch(e) { finish('erro ao definir src: ' + (e && e.message ? e.message : e)); return; }
            setTimeout(() => { if (!done) finish('TIMEOUT 20s'); }, 20000);
        });
    }
    function waitForInFrame(frame, fn, timeout, interval) {
        return new Promise(resolve => {
            const start = Date.now();
            const tick = () => {
                let val = null;
                try { val = fn(frame); } catch(e) { val = null; }
                if (val) { resolve(val); return; }
                if (Date.now() - start > timeout) { resolve(null); return; }
                setTimeout(tick, interval || 300);
            };
            tick();
        });
    }
    function clickInFrame(frame, el) {
        try {
            const evt = frame.contentDocument.createEvent('MouseEvents');
            evt.initMouseEvent('click', true, true, frame.contentWindow, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            el.dispatchEvent(evt);
            return true;
        } catch(e) {
            try { el.click(); return true; } catch(e2) {
                console.warn('ZOE clickInFrame: falha no clique:', e2 && e2.message ? e2.message : e2);
                return false;
            }
        }
    }

    function zoeChatFrameState(frame, uid) {
        const out = {};
        try {
            const w = frame.contentWindow;
            const d = frame.contentDocument;
            out.iframe = {
                id: frame.id || '',
                src: String(frame.src || '').slice(0, 180),
                readyState: d ? d.readyState : null,
                url: '',
                title: d ? String(d.title || '').slice(0, 100) : '',
                bodyLen: d && d.body ? d.body.innerHTML.length : 0
            };
            try { out.iframe.url = w && w.location ? String(w.location.href).slice(0, 180) : ''; }
            catch(e) { out.iframe.url = 'cross-origin'; }
            out.page = {
                visibility: document.visibilityState,
                topFrames: document.querySelectorAll('iframe').length,
                active: document.activeElement ? (document.activeElement.tagName + (document.activeElement.id ? '#' + document.activeElement.id : '')) : null
            };
            if (d) {
                let loginText = null;
                try {
                    const trs = d.querySelectorAll('table tr');
                    for (const tr of trs) {
                        const cells = tr.querySelectorAll('td, th');
                        if (cells.length >= 2 && /^login:?$/i.test(String(cells[0].textContent || '').trim())) {
                            loginText = String(cells[1].textContent || '').trim().slice(0, 60);
                            break;
                        }
                    }
                } catch(e) {}
                out.dom = {
                    loginInputs: d.querySelectorAll('input[type="password"], input[name="login"], input[name="username"]').length,
                    loginText: loginText,
                    messengerLinks: d.querySelectorAll('a.messenger-link').length,
                    wrapper: !!d.getElementById('messenger-dialog-wrapper'),
                    dialogs: d.querySelectorAll('.messenger-dialog').length,
                    dialogIds: Array.prototype.slice.call(d.querySelectorAll('.messenger-dialog'), 0, 5).map(function(x) { return x.id + (x.classList.contains('minimized') ? ':min' : ''); }),
                    inputs: Array.prototype.slice.call(d.querySelectorAll('[id^="message-input-"]'), 0, 5).map(function(x) { return x.id + (x.getClientRects().length ? ':vis' : ':hid'); }),
                    sendButtons: d.querySelectorAll('.messenger-send-button').length,
                    youRows: d.querySelectorAll('.messenger-row.you').length
                };
                if (uid) {
                    const dlg = d.getElementById('messenger-dialog-' + uid);
                    const inp = d.getElementById('message-input-' + uid);
                    const btn = dlg ? dlg.querySelector('.messenger-send-button') : null;
                    out.target = {
                        dialog: !!dlg,
                        dialogClass: dlg ? String(dlg.className || '') : null,
                        dialogVisible: !!(dlg && dlg.getClientRects().length),
                        minimized: !!(dlg && dlg.classList.contains('minimized')),
                        blocked: !!(dlg && dlg.classList.contains('blocked')),
                        input: !!inp,
                        inputVisible: !!(inp && inp.getClientRects().length),
                        inputLen: inp ? String(inp.innerText || inp.textContent || '').length : null,
                        inputText: inp ? String(inp.innerText || inp.textContent || '').replace(/\s+/g, ' ').slice(0, 80) : null,
                        btn: !!btn,
                        btnClass: btn ? String(btn.className || '') : null,
                        btnDisabled: btn ? (btn.disabled === true || btn.getAttribute('disabled') !== null) : null,
                        rowsYou: dlg ? dlg.querySelectorAll('.messenger-row.you').length : null,
                        rowsAll: dlg ? dlg.querySelectorAll('.messenger-row').length : null
                    };
                }
                const m = w && w.mz && w.mz.messenger;
                out.mz = {
                    hasMz: !!(w && w.mz),
                    hasMessenger: !!m,
                    messengerType: m ? typeof m : null,
                    keys: m && typeof m === 'object' ? Object.keys(m).slice(0, 15) : null,
                    eventsBound: m ? !!m.eventsBound : null,
                    hasDialog: !!(m && typeof m.dialog === 'function')
                };
            }
        } catch(e) {
            out.error = e && e.message ? e.message : String(e);
        }
        try {
            const s = JSON.stringify(out);
            return s.length > 2400 ? s.slice(0, 2400) + '…' : s;
        } catch(e) { return '{"error":"state stringify"}'; }
    }

    async function waitForInFrameLogged(frame, fn, timeout, interval, label, uid) {
        const start = Date.now();
        let ticks = 0;
        let lastErr = '';
        let lastProgress = 0;
        const val = await waitForInFrame(frame, (f) => {
            ticks++;
            try {
                const v = fn(f);
                if (v) return v;
            } catch(e) {
                lastErr = e && e.message ? e.message : String(e);
            }
            const elapsed = Date.now() - start;
            if (timeout >= 15000 && elapsed - lastProgress >= 8000) {
                lastProgress = elapsed;
                console.log('ZOE Chat: ' + label + ' — ainda à espera (' + Math.round(elapsed / 1000) + 's/' + Math.round(timeout / 1000) + 's) | ' + zoeChatFrameState(frame, uid));
            }
            return null;
        }, timeout, interval);
        const elapsed = Date.now() - start;
        if (val) {
            console.log('ZOE Chat: ' + label + ' — OK em ' + elapsed + 'ms (' + ticks + ' tentativas)');
        } else {
            console.warn('ZOE Chat: ' + label + ' — TIMEOUT em ' + elapsed + 'ms (' + ticks + ' tentativas)' + (lastErr ? ' | último erro: ' + lastErr : '') + ' | ' + zoeChatFrameState(frame, uid));
        }
        return val;
    }

    async function sendPrivateMessage(sport, receiverName, receiverUid, body, debugCtx) {
        const dbg = debugCtx || {};
        const tag = 'ZOE AutoMsg' + (dbg.runId ? '[' + dbg.runId + (dbg.index ? ' ' + dbg.index + '/' + dbg.total : '') + ']' : '') + ':';
        const t0 = Date.now();
        const frame = getMsgFrame();
        const uid = String(receiverUid);
        const profileUrl = 'https://www.managerzone.com/?p=profile&uid=' + uid + '&_nocache=' + Date.now();
        const bodyText = String(body || '');
        const bodyLinesPreview = bodyText.split(/\r?\n/).slice(0, 3).map(l => l.slice(0, 100));
        console.log(tag, 'sendPrivateMessage START | sport=' + sport + ' | receiver=' + receiverName + ' | uid=' + uid + ' | bodyLen=' + bodyText.length + ' | bodyLines=' + bodyLinesPreview.length + ' | preview=' + JSON.stringify(bodyLinesPreview) + ' | frameSrc=' + String(frame.src || '').slice(0, 140));
        console.log(tag, 'estado inicial | ' + zoeChatFrameState(frame, uid));
        await loadInFrame(frame, profileUrl);
        console.log(tag, 'perfil carregado em ' + (Date.now() - t0) + 'ms | ' + zoeChatFrameState(frame, uid));
        const cleanLabel = (txt) => String(txt || '').replace(/[:：\s]+$/, '').trim().toLowerCase();
        const loginLabels = ['login', 'username', 'utilizador', 'user', 'nome de utilizador', 'nickname'];
        const profileLogin = await waitForInFrameLogged(frame, (f) => {
            const d = f.contentDocument;
            if (!d) return null;
            const rows = d.querySelectorAll('table tr');
            for (const tr of rows) {
                const cells = tr.querySelectorAll('td, th');
                if (cells.length >= 2 && loginLabels.includes(cleanLabel(cells[0].textContent))) {
                    const v = (cells[1].textContent || '').trim();
                    if (v) return v;
                }
            }
            const allCells = d.querySelectorAll('td, th, dt, li, label, span, div, b, strong');
            for (const cell of allCells) {
                if (cell.tagName === 'A') continue;
                const closestLink = cell.closest('a');
                if (closestLink && closestLink.getAttribute('href')) continue;
                const inNav = cell.closest('nav, header, .nav, .top-bar, .menu, #header');
                if (inNav) continue;
                if (!loginLabels.includes(cleanLabel(cell.textContent))) continue;
                const next = cell.nextElementSibling;
                if (next) {
                    const v = (next.textContent || '').trim().replace(/\s+/g, ' ');
                    if (v && v.length < 60 && !loginLabels.includes(cleanLabel(v))) return v;
                }
                const row = cell.closest('tr');
                if (row) {
                    const c = row.querySelectorAll('td, th');
                    for (let k = 0; k < c.length; k++) {
                        if (c[k] === cell) continue;
                        const v = (c[k].textContent || '').trim();
                        if (v && v.length < 60) return v;
                    }
                }
            }
            return null;
        }, 15000, 300, tag + ' campo Login', uid);
        if (profileLogin && profileLogin.toLowerCase() !== String(receiverName || '').trim().toLowerCase()) {
            console.error(tag, 'PERFIL ERRADO | abriu para "' + profileLogin + '", esperava-se "' + receiverName + '" (uid ' + uid + ') | ' + zoeChatFrameState(frame, uid));
            return false;
        }
        if (profileLogin) {
            console.log(tag, 'login do perfil confirmado = ' + profileLogin + ' (match com *user*)');
        } else {
            let profileSnippet = '';
            try {
                const d = frame.contentDocument;
                const title = d && d.title ? d.title : '';
                const h1 = d && d.querySelector('h1');
                const table = d && d.querySelector('table');
                profileSnippet = (title ? 'TITLE: ' + title + ' | ' : '') + (h1 ? 'H1: ' + (h1.textContent || '').trim() + ' | ' : '') + (table ? table.outerHTML.substring(0, 1500) : (d && d.body ? d.body.innerHTML.substring(0, 900) : ''));
            } catch(e) {}
            console.warn(tag, 'campo Login não encontrado no perfil de ' + receiverName + ' (uid ' + uid + '), a validar pelo link de mensagens | ' + zoeChatFrameState(frame, uid));
            if (profileSnippet) console.warn(tag, 'campo Login não encontrado — snippet | perfil=' + receiverName + ' | uid=' + uid + ' | ' + profileSnippet);
        }
        let linkCandidates = [];
        try {
            const d = frame.contentDocument;
            linkCandidates = Array.prototype.slice.call(d.querySelectorAll('a.messenger-link, a[href*="p=messenger"], a[href*="p=messages"]'), 0, 10).map(function(a) { return String(a.getAttribute('href') || '').slice(0, 180); });
        } catch(e) {}
        console.log(tag, 'links de mensagens no perfil (' + linkCandidates.length + '): ' + JSON.stringify(linkCandidates));
        const link = await waitForInFrameLogged(frame, (f) => {
            const d = f.contentDocument;
            if (!d) return null;
            return d.querySelector('a.messenger-link[href*="uid=' + uid + '"]') ||
                   d.querySelector('a.messenger-link') ||
                   d.querySelector('a[href*="p=messenger"][href*="uid=' + uid + '"]') ||
                   d.querySelector('a[href*="p=messages"][href*="uid=' + uid + '"]') ||
                   d.querySelector('a[href*="p=messenger"]') ||
                   d.querySelector('a[href*="p=messages"]');
        }, 12000, 300, tag + ' link de mensagens', uid);
        if (!link) {
            let linkSnippet = '';
            try {
                const d = frame.contentDocument;
                const body = d && d.body;
                if (body) {
                    const links = body.querySelectorAll('a[href*="messenger"], a[href*="p=messages"], a[href*="uid=' + uid + '"]');
                    linkSnippet = Array.prototype.slice.call(links, 0, 6).map(a => a.outerHTML).join(' ');
                    if (!linkSnippet) linkSnippet = body.innerHTML.substring(0, 1000);
                }
            } catch(e) {}
            console.error(tag, 'LINK DE MENSAGENS NÃO ENCONTRADO | perfil=' + receiverName + ' | uid=' + uid + ' | ' + zoeChatFrameState(frame, uid));
            if (linkSnippet) console.error(tag, 'LINK DE MENSAGENS NÃO ENCONTRADO — links/snippet | perfil=' + receiverName + ' | uid=' + uid + ' | ' + linkSnippet);
            return false;
        }
        const href = link.getAttribute('href') || '';
        console.log(tag, 'link escolhido: ' + String(href).slice(0, 200) + ' | onclick=' + String(link.getAttribute('onclick') || '').slice(0, 160) + ' | outerHTML=' + String(link.outerHTML || '').slice(0, 240));
        if (href.indexOf('uid=' + uid) < 0) {
            console.error(tag, 'PERFIL NÃO CORRESPONDE AO UID | esperado=' + uid + ' | href=' + href + ' | ' + zoeChatFrameState(frame, uid));
            return false;
        }
        let initTried = false;
        let initError = '';
        const messenger = await waitForInFrameLogged(frame, (f) => {
            const w = f.contentWindow;
            const d = f.contentDocument;
            if (!w || !d || !d.getElementById('messenger-dialog-wrapper')) return null;
            const m = w.mz && w.mz.messenger;
            if (!m || typeof m.dialog !== 'function') return null;
            if (m.eventsBound) return m;
            if (!initTried) {
                initTried = true;
                try {
                    m.initialize();
                    console.log(tag, 'mz.messenger.initialize() forçado para ' + receiverName);
                } catch(e) {
                    initError = e && e.message ? e.message : String(e);
                    console.warn(tag, 'falha ao forçar initialize() do messenger: ' + initError);
                }
            }
            return m.eventsBound ? m : null;
        }, 30000, 300, tag + ' mz.messenger pronto', uid);
        console.log(tag, 'estado após espera do messenger | initTried=' + initTried + ' | initError=' + (initError || 'none') + ' | ' + zoeChatFrameState(frame, uid));
        let dialogOpened = false;
        let messengerApi = null;
        try {
            const w = frame.contentWindow;
            messengerApi = w.mz && w.mz.messenger;
        } catch(e) {}
        if (!messengerApi) messengerApi = messenger;
        const canDialog = !!(messengerApi && typeof messengerApi.dialog === 'function');
        const hasWrapper = !!(frame.contentDocument && frame.contentDocument.getElementById('messenger-dialog-wrapper'));
        console.log(tag, 'API messenger | canDialog=' + canDialog + ' | eventsBound=' + !!(messengerApi && messengerApi.eventsBound) + ' | wrapper=' + hasWrapper + ' | hasMessengerObj=' + !!messenger);
        if (canDialog && hasWrapper) {
            try {
                const dialogReturn = messengerApi.dialog(uid);
                dialogOpened = true;
                console.log(tag, 'diálogo aberto via mz.messenger.dialog(' + uid + ') | retorno=' + String(dialogReturn).slice(0, 80));
            } catch(e) {
                console.warn(tag, 'falha ao abrir diálogo diretamente: ' + (e && e.stack ? e.stack : e));
            }
        }
        if (!dialogOpened) {
            const clicked = clickInFrame(frame, link);
            console.log(tag, 'fallback clique no link do messenger | resultado=' + clicked + ' | ' + zoeChatFrameState(frame, uid));
        }
        const input = await waitForInFrameLogged(frame, (f) => {
            const d = f.contentDocument;
            if (!d) return null;
            const el = d.getElementById('message-input-' + uid);
            const dlg = d.getElementById('messenger-dialog-' + uid);
            if (!el || !dlg) return null;
            if (dlg.classList.contains('minimized')) {
                const header = dlg.querySelector('.messenger-dialog-header');
                if (header) clickInFrame(f, header);
                return null;
            }
            if (el.getClientRects().length === 0) return null;
            return el;
        }, 45000, 300, tag + ' caixa de mensagem', uid);
        if (!input) {
            let frameInfo = '';
            let dlgInfo = '';
            try {
                const w = frame.contentWindow;
                const d = frame.contentDocument;
                frameInfo = ' (url: ' + w.location.href + ', dialogs: ' + d.querySelectorAll('.messenger-dialog').length + ', inputs: ' + d.querySelectorAll('[id^="message-input-"]').length + ', eventsBound: ' + !!(w.mz && w.mz.messenger && w.mz.messenger.eventsBound) + ')';
                const dlg = d.getElementById('messenger-dialog-' + uid);
                if (dlg) {
                    dlgInfo = ' | dialogClass="' + String(dlg.className || '') + '" | dialogText="' + String(dlg.innerText || '').replace(/\s+/g, ' ').slice(-700) + '"';
                } else if (d.body) {
                    dlgInfo = ' | bodySnippet="' + String(d.body.innerText || '').replace(/\s+/g, ' ').slice(-700) + '"';
                }
            } catch(e) {}
            console.error(tag, 'CAIXA DE MENSAGEM NÃO APARECEU | receiver=' + receiverName + ' | uid=' + uid + frameInfo + ' | ' + zoeChatFrameState(frame, uid));
            if (dlgInfo) console.error(tag, 'CAIXA DE MENSAGEM NÃO APARECEU — detalhe | receiver=' + receiverName + ' | uid=' + uid + dlgInfo);
            return false;
        }
        input.focus();
        console.log(tag, 'input encontrado | tag=' + input.tagName + ' | class=' + String(input.className || '') + ' | contenteditable=' + String(input.getAttribute('contenteditable')) + ' | rects=' + input.getClientRects().length + ' | textLen=' + String(input.innerText || input.textContent || '').length);
        try {
            const active = frame.contentDocument.activeElement;
            console.log(tag, 'input.focus() | activeElement=' + (active ? (active.tagName + (active.id ? '#' + active.id : '')) : 'null'));
        } catch(e) {}
        const lines = String(body || '').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const linesToSend = lines.length > 0 ? lines : [String(body || '').trim()];
        let sentCount = 0;
        let beforeCount = frame.contentDocument.querySelectorAll('#messenger-dialog-' + uid + ' .messenger-row.you').length;
        let dialogRowsAll = 0;
        try { dialogRowsAll = frame.contentDocument.querySelectorAll('#messenger-dialog-' + uid + ' .messenger-row').length; } catch(e) {}
        console.log(tag, 'linhas a enviar=' + linesToSend.length + ' | beforeCount=' + beforeCount + ' | dialogRows=' + dialogRowsAll);
        for (let li = 0; li < linesToSend.length; li++) {
            const line = linesToSend[li];
            input.focus();
            input.innerText = line;
            let inputState = '';
            try {
                inputState = 'innerTextLen=' + String(input.innerText || '').length + ' | textLen=' + String(input.textContent || '').length + ' | valueLen=' + String(input.value || '').length + ' | htmlLen=' + String(input.innerHTML || '').length;
            } catch(e) {
                inputState = 'inputStateError=' + (e && e.message ? e.message : e);
            }
            try {
                const evt = frame.contentDocument.createEvent('Event');
                evt.initEvent('input', true, false);
                input.dispatchEvent(evt);
            } catch(e) {}
            const sendBtn = frame.contentDocument.querySelector('#messenger-dialog-' + uid + ' .messenger-send-button');
            if (!sendBtn) {
                let dlgHtml = '';
                try {
                    const dlg = frame.contentDocument.getElementById('messenger-dialog-' + uid);
                    dlgHtml = dlg ? dlg.innerHTML.slice(-1200) : '';
                } catch(e) {}
                console.error(tag, 'SEND BUTTON NÃO ENCONTRADO | linha=' + (li + 1) + '/' + linesToSend.length + ' | texto="' + line.substring(0, 80) + '" | ' + zoeChatFrameState(frame, uid));
                if (dlgHtml) console.error(tag, 'SEND BUTTON NÃO ENCONTRADO — dialogHTML | linha=' + (li + 1) + '/' + linesToSend.length + ' | ' + dlgHtml);
                return false;
            }
            const first = line.substring(0, 60);
            let btnState = '';
            try {
                btnState = 'class=' + String(sendBtn.className || '') + ' | disabled=' + (sendBtn.disabled === true || sendBtn.getAttribute('disabled') !== null) + ' | rects=' + sendBtn.getClientRects().length + ' | html=' + String(sendBtn.outerHTML || '').slice(0, 160);
            } catch(e) {
                btnState = 'btnStateError=' + (e && e.message ? e.message : e);
            }
            console.log(tag, 'linha ' + (li + 1) + '/' + linesToSend.length + ' | len=' + line.length + ' | first="' + first + '" | input: ' + inputState + ' | btn: ' + btnState + ' | rowsAntes=' + beforeCount);
            const clicked = clickInFrame(frame, sendBtn);
            console.log(tag, 'clique send=' + clicked + ' | rowsAntes=' + beforeCount);
            const sent = await waitForInFrameLogged(frame, (f) => {
                const d = f.contentDocument;
                if (!d) return null;
                const rows = d.querySelectorAll('#messenger-dialog-' + uid + ' .messenger-row.you');
                if (rows.length <= beforeCount) return null;
                for (let i = rows.length - 1; i >= beforeCount; i--) {
                    if (first && (rows[i].textContent || '').indexOf(first) >= 0) return true;
                }
                return null;
            }, 20000, 300, tag + ' confirmação linha ' + (li + 1), uid);
            if (sent) {
                beforeCount = frame.contentDocument.querySelectorAll('#messenger-dialog-' + uid + ' .messenger-row.you').length;
                sentCount++;
                let lastRowInfo = '';
                try {
                    const rows = frame.contentDocument.querySelectorAll('#messenger-dialog-' + uid + ' .messenger-row.you');
                    const last = rows.length ? rows[rows.length - 1] : null;
                    if (last) lastRowInfo = ' | lastRowId=' + last.id + ' | lastRowText="' + String(last.textContent || '').replace(/\s+/g, ' ').slice(0, 100) + '"';
                } catch(e) {}
                console.log(tag, 'linha ' + (li + 1) + ' CONFIRMADA | rowsAgora=' + beforeCount + lastRowInfo);
            } else {
                let dlgText = '', dlgHtml = '', lastRows = '';
                try {
                    const dlg = frame.contentDocument.getElementById('messenger-dialog-' + uid);
                    if (dlg) {
                        dlgText = String(dlg.innerText || '').replace(/\s+/g, ' ').slice(-900);
                        dlgHtml = dlg.innerHTML.slice(-600);
                        const rows = dlg.querySelectorAll('.messenger-row');
                        lastRows = Array.prototype.slice.call(rows, Math.max(0, rows.length - 3)).map(function(r) {
                            return (r.id || '?') + '|' + String(r.className || '').replace(/\s+/g, '.') + '|' + String(r.textContent || '').replace(/\s+/g, ' ').slice(0, 90);
                        }).join(' || ');
                    }
                } catch(e) {}
                console.warn(tag, 'LINHA SEM CONFIRMAÇÃO | linha=' + (li + 1) + '/' + linesToSend.length + ' | texto="' + first + '" | ' + zoeChatFrameState(frame, uid));
                if (lastRows) console.warn(tag, 'LINHA SEM CONFIRMAÇÃO — últimas rows | linha=' + (li + 1) + '/' + linesToSend.length + ' | ' + lastRows);
                if (dlgText || dlgHtml) console.warn(tag, 'LINHA SEM CONFIRMAÇÃO — conteúdo | linha=' + (li + 1) + '/' + linesToSend.length + ' | dialogText="' + dlgText + '" | dialogHTML=' + dlgHtml);
                return false;
            }
        }
        console.log(tag, 'PM FIM | ' + receiverName + ' — ' + sentCount + '/' + linesToSend.length + ' linhas confirmadas | total=' + (Date.now() - t0) + 'ms');
        return sentCount === linesToSend.length;
    }

    function getSportAccent(sport) {
        return sport === 'hockey' ? '#2196f3' : '#4caf50';
    }

        function confirmAutoMessageSend(sport, missing, showDefer, isChat) {
        return new Promise(resolve => {
            const t0 = Date.now();
            const selfUser = (typeof detectCurrentUser === 'function' && detectCurrentUser()) || '';
            const beforeSelf = missing.slice();
            if (selfUser) {
                missing = missing.filter(m => m.name.toLowerCase() !== selfUser.toLowerCase());
            }
            console.log('ZOE AutoMsg: confirmação START | sport=' + sport + ' | isChat=' + !!isChat + ' | showDefer=' + !!showDefer + ' | visibility=' + document.visibilityState + ' | selfUser=' + (selfUser || '?') + ' | antes=' + beforeSelf.length + ' | depoisSelf=' + missing.length + ' | removidos=' + JSON.stringify(beforeSelf.filter(m => selfUser && m.name.toLowerCase() === selfUser.toLowerCase()).map(m => m.name)) + ' | managers=' + JSON.stringify(missing.map(m => m.name + '#' + m.uid)));
            const doc = document;
            const showModal = () => {
                const accent = getSportAccent(sport);
                const overlay = doc.createElement('div');
                overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000001;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center';
                const modal = doc.createElement('div');
                modal.style.cssText = 'background:#1a1a2e;border:2px solid ' + accent + ';border-radius:10px;padding:16px 10px;font-family:Arial,sans-serif;color:#eee;font-size:13px;width:85%;max-width:460px;max-height:80vh;overflow-y:auto;box-shadow:0 4px 24px rgba(0,0,0,0.7)';
                const esc = (n) => String(n || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                const exclusions = isChat ? getChatExclusions(sport) : {};
                const namesHtml = missing.map(m => {
                    const exclReason = isChat ? (exclusions[m.uid] || null) : null;
                    const checked = exclReason ? '' : ' checked';
                    const reasonAttr = exclReason ? ' data-reason="' + esc(exclReason) + '"' : '';
                    return '<div style="padding:2px 0"><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" class="zoe-amsg-confirm-cb" value="' + m.uid + '"' + checked + '> <span class="zoe-chat-name" data-uid="' + m.uid + '"' + reasonAttr + (exclReason ? ' style="color:#ffb74d;border-bottom:1px dashed #ffb74d;cursor:help"' : '') + '>' + esc(m.name) + '</span>' + (m.team ? ' (' + esc(m.team) + ')' : '') + (m.isMain ? ' <span style="color:#ffc107">(Membro Principal)</span>' : '') + '</label></div>';
                }).join('');
                modal.innerHTML = '<div style="display:flex;align-items:center;margin-bottom:12px;position:relative"><b style="font-size:14px;color:' + accent + ';width:100%;text-align:center">' + t('chatConfirmTitle') + '</b><span id="zoe-amsg-confirm-x" style="cursor:pointer;font-size:16px;color:#999;position:absolute;right:0;top:0">&times;</span></div>';
                modal.innerHTML += '<div style="margin-bottom:8px;color:#eee">' + t('chatConfirmMessage') + ' <b>' + missing.length + '</b> ' + t('chatConfirmManagers') + '</div>';
                modal.innerHTML += '<div style="background:#16213e;border:1px solid #555;border-radius:6px;padding:8px 10px;margin-bottom:6px;max-height:200px;overflow-y:auto">' + namesHtml + '</div>';
                modal.innerHTML += '<div style="font-size:11px;color:#888;margin-bottom:6px">' + t('chatConfirmInstruction') + '</div>';
                modal.innerHTML += '<div style="font-size:11px;color:#888;margin-bottom:12px">' + t('chatConfirmPermission') + '</div>';
                modal.innerHTML += '<div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;flex-wrap:wrap"><button id="zoe-amsg-confirm-cancel" style="background:#555;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">' + t('chatConfirmCancel') + '</button>' + (showDefer ? '<button id="zoe-amsg-confirm-defer" style="background:#ff9800;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">' + t('chatConfirmDefer') + '</button>' : '') + '<button id="zoe-amsg-confirm-send" style="background:' + accent + ';color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">' + t('chatConfirmSend') + '</button></div>';
                overlay.appendChild(modal);
                doc.body.appendChild(overlay);
                try {
                    const cbs = overlay.querySelectorAll('.zoe-amsg-confirm-cb');
                    const checkedCount = Array.prototype.filter.call(cbs, cb => cb.checked).length;
                    console.log('ZOE AutoMsg: confirmação MODAL ABERTO | checkboxes=' + cbs.length + ' | checked=' + checkedCount + ' | exclusions=' + JSON.stringify(isChat ? getChatExclusions(sport) : {}) + ' | overlayNoDOM=' + !!doc.body.contains(overlay));
                } catch(e) {
                    console.warn('ZOE AutoMsg: erro ao inspecionar modal: ' + (e && e.message ? e.message : e));
                }
                let tip = null;
                const hideTip = () => { if (tip) { tip.remove(); tip = null; } };
                const showTip = (el) => {
                    if (!el || !el.dataset.reason) return;
                    hideTip();
                    tip = doc.createElement('div');
                    tip.style.cssText = 'position:fixed;z-index:10000003;background:#16213e;border:1px solid #ffb74d;color:#eee;font-size:12px;padding:6px 10px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.6);max-width:300px;white-space:pre-wrap;pointer-events:none';
                    tip.textContent = 'Motivo da Exclusão: ' + el.dataset.reason;
                    doc.body.appendChild(tip);
                    const r = el.getBoundingClientRect();
                    tip.style.left = Math.min(r.left, window.innerWidth - tip.offsetWidth - 8) + 'px';
                    tip.style.top = (r.bottom + 6) + 'px';
                };
                const close = (val) => {
                    console.log('ZOE AutoMsg: confirmação FECHADA | decisão=' + JSON.stringify(val) + ' | duração=' + (Date.now() - t0) + 'ms');
                    hideTip();
                    overlay.remove();
                    resolve(val);
                };
                const askCancelConfirm = () => new Promise(resolveC => {
                    const co = doc.createElement('div');
                    co.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000002;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center';
                    const cm = doc.createElement('div');
                    cm.style.cssText = 'background:#1a1a2e;border:2px solid #f44336;border-radius:10px;padding:16px;font-family:Arial,sans-serif;color:#eee;font-size:13px;width:85%;max-width:400px;box-shadow:0 4px 24px rgba(0,0,0,0.7)';
                    cm.innerHTML = '<div style="margin-bottom:12px;line-height:1.5">' + t('cancelConfirmMessage') + '</div>';
                    cm.innerHTML += '<div style="display:flex;justify-content:flex-end;align-items:center;gap:8px"><button id="zoe-amsg-cancel-no" style="background:#555;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">' + t('cancelConfirmNo') + '</button><button id="zoe-amsg-cancel-yes" style="background:#f44336;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">' + t('cancelConfirmYes') + '</button></div>';
                    co.appendChild(cm);
                    doc.body.appendChild(co);
                    const done = (v) => { co.remove(); resolveC(v); };
                    co.querySelector('#zoe-amsg-cancel-no').onclick = () => done(false);
                    co.querySelector('#zoe-amsg-cancel-yes').onclick = () => done(true);
                    co.addEventListener('mousedown', (e) => { if (e.target === co) done(false); });
                });
                overlay.querySelector('#zoe-amsg-confirm-send').onclick = () => {
                    const checked = Array.prototype.filter.call(overlay.querySelectorAll('.zoe-amsg-confirm-cb'), cb => cb.checked).map(cb => cb.value);
                    console.log('ZOE AutoMsg: confirmação CLIQUE ENVIAR | checked=' + JSON.stringify(checked));
                    if (checked.length === 0) {
                        alert(t('chatSelectManager'));
                        return;
                    }
                    close(checked);
                };
                overlay.querySelector('#zoe-amsg-confirm-cancel').onclick = async () => {
                    console.log('ZOE AutoMsg: confirmação CLIQUE CANCELAR');
                    const sure = await askCancelConfirm();
                    console.log('ZOE AutoMsg: confirmação cancelamento confirmado=' + sure);
                    if (sure) close('cancel');
                };
                const deferBtn = overlay.querySelector('#zoe-amsg-confirm-defer');
                if (deferBtn) deferBtn.onclick = () => { console.log('ZOE AutoMsg: confirmação CLIQUE ADIAR'); close('defer'); };
                overlay.querySelector('#zoe-amsg-confirm-x').onclick = () => { console.log('ZOE AutoMsg: confirmação CLIQUE X'); close(false); };
                overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) { console.log('ZOE AutoMsg: confirmação CLIQUE FORA DO MODAL'); close(false); } });
                if (isChat) {
                    const openReasonModal = (cbEl) => new Promise(resolveR => {
                        const nameSpan = cbEl.closest('label').querySelector('.zoe-chat-name');
                        const ro = doc.createElement('div');
                        ro.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000002;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center';
                        const rm = doc.createElement('div');
                        rm.style.cssText = 'background:#1a1a2e;border:2px solid #f44336;border-radius:10px;padding:16px 10px;font-family:Arial,sans-serif;color:#eee;font-size:13px;width:85%;max-width:420px;box-shadow:0 4px 24px rgba(0,0,0,0.7)';
                        rm.innerHTML = '<div style="display:flex;align-items:center;margin-bottom:12px;position:relative"><b style="font-size:14px;color:#f44336;width:100%;text-align:center">Motivo da Exclusão</b><span id="zoe-chat-excl-x" style="cursor:pointer;font-size:16px;color:#999;position:absolute;right:0;top:0">&times;</span></div>';
                        rm.innerHTML += '<div style="margin-bottom:8px;color:#eee">Porque é que <b>' + esc(nameSpan.textContent) + '</b> não deve receber a mensagem do Chat?</div>';
                        rm.innerHTML += '<textarea id="zoe-chat-excl-reason" style="width:100%;padding:6px;border:1px solid #555;border-radius:4px;background:#16213e;color:#eee;font-size:12px;box-sizing:border-box;resize:vertical;min-height:70px" placeholder="Escreve o motivo..."></textarea>';
                        rm.innerHTML += '<div style="font-size:11px;color:#888;margin-top:4px">Este motivo fica guardado e será mostrado ao passar o rato por cima do manager nas próximas jornadas (o manager fica excluído até o re-ativares).</div>';
                        rm.innerHTML += '<div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:12px"><button id="zoe-chat-excl-cancel" style="background:#555;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">Cancelar</button><button id="zoe-chat-excl-save" style="background:#f44336;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">Guardar</button></div>';
                        ro.appendChild(rm);
                        doc.body.appendChild(ro);
                        const done = (reason) => { ro.remove(); resolveR(reason); };
                        const reasonTa = rm.querySelector('#zoe-chat-excl-reason');
                        reasonTa.focus();
                        rm.querySelector('#zoe-chat-excl-save').onclick = () => {
                            const val = reasonTa.value.trim();
                            if (!val) { alert('Escreve um motivo para a exclusão.'); return; }
                            done(val);
                        };
                        rm.querySelector('#zoe-chat-excl-cancel').onclick = () => done(null);
                        rm.querySelector('#zoe-chat-excl-x').onclick = () => done(null);
                        ro.addEventListener('mousedown', (e) => { if (e.target === ro) done(null); });
                    });
                    overlay.querySelectorAll('.zoe-chat-name').forEach(n => {
                        n.addEventListener('mouseenter', () => showTip(n));
                        n.addEventListener('mouseleave', hideTip);
                    });
                    overlay.querySelectorAll('.zoe-amsg-confirm-cb').forEach(cb => {
                        cb.addEventListener('change', async () => {
                            const uid = cb.value;
                            const nameSpan = overlay.querySelector('.zoe-chat-name[data-uid="' + uid + '"]');
                            console.log('ZOE AutoMsg: confirmação CHECKBOX | uid=' + uid + ' | checked=' + cb.checked + ' | nome=' + (nameSpan ? nameSpan.textContent : '?'));
                            if (!cb.checked) {
                                const reason = await openReasonModal(cb);
                                console.log('ZOE AutoMsg: confirmação motivo exclusão | uid=' + uid + ' | reason=' + JSON.stringify(reason));
                                if (reason) {
                                    saveChatExclusion(sport, uid, reason);
                                    if (nameSpan) {
                                        nameSpan.dataset.reason = reason;
                                        nameSpan.style.color = '#ffb74d';
                                        nameSpan.style.borderBottom = '1px dashed #ffb74d';
                                        nameSpan.style.cursor = 'help';
                                    }
                                } else {
                                    cb.checked = true;
                                }
                            } else {
                                removeChatExclusion(sport, uid);
                                console.log('ZOE AutoMsg: confirmação exclusão removida | uid=' + uid + ' | exclusions=' + JSON.stringify(getChatExclusions(sport)));
                                if (nameSpan) {
                                    delete nameSpan.dataset.reason;
                                    nameSpan.style.color = '';
                                    nameSpan.style.borderBottom = '';
                                    nameSpan.style.cursor = '';
                                }
                            }
                        });
                    });
                }
            };
            if (doc.visibilityState === 'hidden') {
                console.log('ZOE AutoMsg: confirmação tab não ativa (hidden), a aguardar ficar visível | missing=' + missing.length);
                const onVis = () => {
                    console.log('ZOE AutoMsg: confirmação visibilitychange | state=' + doc.visibilityState);
                    if (doc.visibilityState === 'visible') {
                        doc.removeEventListener('visibilitychange', onVis);
                        showModal();
                    }
                };
                doc.addEventListener('visibilitychange', onVis);
            } else {
                console.log('ZOE AutoMsg: confirmação tab visível, a abrir modal | missing=' + missing.length);
                showModal();
            }
        });
    }

    function showAutoMessageResult(sport, sentOk, failed, successNames, failNames) {
        const doc = document;
        const accent = getSportAccent(sport);
        const failedSome = failed > 0;
        const color = sentOk > 0 ? (failedSome ? '#f44336' : accent) : '#f44336';
        const overlay = doc.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000002;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center';
        const modal = doc.createElement('div');
        modal.style.cssText = 'background:#1a1a2e;border:2px solid ' + color + ';border-radius:10px;padding:16px 10px;font-family:Arial,sans-serif;color:#eee;font-size:13px;width:85%;max-width:460px;max-height:80vh;overflow-y:auto;box-shadow:0 4px 24px rgba(0,0,0,0.7)';
        const esc = (n) => String(n || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        let html = '<div style="display:flex;align-items:center;margin-bottom:12px;position:relative"><b style="font-size:14px;color:' + color + ';width:100%;text-align:center">' + t('sendResultTitle') + '</b><span id="zoe-amsg-result-x" style="cursor:pointer;font-size:16px;color:#999;position:absolute;right:0;top:0">&times;</span></div>';
        if (sentOk > 0) {
            html += '<div style="margin-bottom:8px;color:#4caf50">' + t('sendSuccessMessage') + ' <b>' + sentOk + '</b> ' + t('sendSuccessManagers') + '</div>';
            html += '<div style="background:#16213e;border:1px solid #4caf50;border-radius:6px;padding:8px 10px;margin-bottom:12px;max-height:160px;overflow-y:auto">' + successNames.map(n => '<div style="padding:2px 0">• ' + esc(n) + '</div>').join('') + '</div>';
        } else {
            html += '<div style="margin-bottom:8px;color:#f44336">Nenhuma mensagem foi enviada.</div>';
        }
        if (failedSome) {
            html += '<div style="margin-bottom:8px;color:#f44336">Falhou o envio para <b>' + failed + '</b> manager(s):</div>';
            html += '<div style="background:#16213e;border:1px solid #f44336;border-radius:6px;padding:8px 10px;margin-bottom:12px;max-height:160px;overflow-y:auto">' + failNames.map(n => '<div style="padding:2px 0">• ' + esc(n) + '</div>').join('') + '</div>';
        }
        html += '<div style="display:flex;justify-content:flex-end;align-items:center;gap:12px"><button id="zoe-amsg-result-ok" style="background:' + accent + ';color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">OK</button></div>';
        modal.innerHTML = html;
        overlay.appendChild(modal);
        doc.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('#zoe-amsg-result-ok').onclick = close;
        overlay.querySelector('#zoe-amsg-result-x').onclick = close;
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    }

    async function showMissingManagersList(sport) {
        const accent = getSportAccent(sport);
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000003;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center';
        const modal = document.createElement('div');
        modal.style.cssText = 'background:#1a1a2e;border:2px solid ' + accent + ';border-radius:10px;padding:16px 10px;font-family:Arial,sans-serif;color:#eee;font-size:13px;width:80%;max-width:340px;max-height:80vh;overflow-y:auto;box-shadow:0 4px 24px rgba(0,0,0,0.7)';
        modal.innerHTML = '<div style="display:flex;align-items:center;margin-bottom:12px;position:relative"><b style="font-size:14px;color:' + accent + ';width:100%;text-align:center">' + t('managersNotPlayed') + '</b><span id="zoe-amsg-list-x" style="cursor:pointer;font-size:16px;color:#999;position:absolute;right:0;top:0">&times;</span></div>';
        modal.innerHTML += '<div id="zoe-amsg-list-body" style="font-size:12px;color:#888">' + t('loadingList') + '</div>';
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('#zoe-amsg-list-x').onclick = close;
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
        const esc = (n) => String(n || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const body = modal.querySelector('#zoe-amsg-list-body');
        try {
            // verificar que a nossa federação está entre as opções do federation-select
            let ourId = extractOurFedIdFromSelectVal();
            if (!ourId) ourId = getOurFedId() || detectFedIdFromHash();
            const selValues = [];
            const selOpts = document.querySelectorAll('#federation-select option');
            for (const o of selOpts) {
                const v = (o.value || '').trim();
                if (/^\d+$/.test(v)) selValues.push(v);
            }
            if (!ourId) ourId = await fetchOurFedId();
            if (selValues.length > 0 && !selValues.includes(String(ourId))) {
                if (body) body.innerHTML = '<div style="color:#f44336">Não pertences a nenhuma das federações.</div>';
                return;
            }
            const nextRound = await fetchNextRoundData(sport);
            if (!nextRound) {
                if (body) body.innerHTML = '<div style="color:#f44336">Não foi possível obter os dados da jornada.</div>';
                return;
            }
            const members = await fetchClashMissingManagers(sport, nextRound);
            if (!members || !members.all || members.all.length === 0) {
                if (body) body.innerHTML = '<div style="color:#f44336">Não foi possível carregar a lista de membros do confronto.</div>';
                return;
            }
            const selfUser = (typeof detectCurrentUser === 'function' && detectCurrentUser()) || '';
            if (selfUser) {
                members.missing = members.missing.filter(m => m.name.toLowerCase() !== selfUser.toLowerCase());
            }
            if (members.missing.length === 0) {
                if (body) body.innerHTML = '<div style="color:#4caf50">Todos os managers já jogaram nesta jornada (' + members.all.length + ').</div>';
                return;
            }
            body.innerHTML = '<div style="margin-bottom:8px;color:#eee">' + t('missingToPlay') + ' <b>' + members.missing.length + '</b>' + t('missingOf') + '<b>' + members.all.length + '</b> ' + t('missingManagers') + '</div>';
            body.innerHTML += '<div style="background:#16213e;border:1px solid #ffc107;border-radius:6px;padding:8px 10px;max-height:220px;overflow-y:auto">' + members.missing.map(m => '<div style="padding:2px 0"><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" class="zoe-amsg-list-cb" value="' + m.uid + '" checked> ' + esc(m.name) + (m.team ? ' (' + esc(m.team) + ')' : '') + (m.isMain ? ' <span style="color:#ffc107">' + t('mainMember') + '</span>' : '') + '</label></div>').join('') + '</div>';
            body.innerHTML += '<div style="margin-top:6px;color:#888;font-size:11px">' + t('deselectManagers') + '</div>';
            const sent = getAutoMsgSentState(sport);
            const bulkSent = !!(sent && sent.round === nextRound.round);
            const sendBtnColor = sport === 'hockey' ? '#1565c0' : '#2e7d32';
            const sendBtnStyle = bulkSent
                ? 'background:#555;color:#999;border:none;padding:6px 16px;border-radius:4px;font-size:12px;cursor:not-allowed'
                : 'background:' + sendBtnColor + ';color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px';
            body.innerHTML += '<div style="display:flex;justify-content:center;align-items:center;gap:12px;margin-top:12px"><button id="zoe-amsg-list-send" style="' + sendBtnStyle + '">' + t('sendMessageBtn') + '</button></div>';
            const sendBtn = modal.querySelector('#zoe-amsg-list-send');
            if (sendBtn && !bulkSent) {
                sendBtn.onclick = () => {
                    const checked = Array.prototype.filter.call(modal.querySelectorAll('.zoe-amsg-list-cb'), cb => cb.checked).map(cb => cb.value);
                    if (checked.length === 0) {
                        alert(t('chatSelectManager'));
                        return;
                    }
                    close();
                    executeAutoMessage(sport, false, checked).catch(function(e) { console.log('ZOE AutoMsg: erro ao enviar via lista:', e); });
                };
            }
        } catch(e) {
            console.warn('ZOE AutoMsg: erro ao mostrar lista:', e.message);
            const body = modal.querySelector('#zoe-amsg-list-body');
            if (body) body.innerHTML = '<div style="color:#f44336">Erro ao carregar a lista: ' + esc(String(e.message || e)) + '</div>';
        }
    }

    function ensureAutoMsgStatusEl(sport) {
        if (window._zoeAutoMsgStatusEl && window._zoeAutoMsgStatusEl.parentNode) {
            if (!window._zoeAutoMsgStatusEl.onclick) window._zoeAutoMsgStatusEl.onclick = () => showMissingManagersList(sport);
            return window._zoeAutoMsgStatusEl;
        }
        const el = document.createElement('div');
        el.id = 'zoe-automsg-status';
        el.style.cssText = 'padding:6px 12px;background:#1a1a2e;color:#ffc107;border:1px solid #ffc107;border-radius:6px;cursor:pointer;white-space:nowrap';
        el.title = 'Clicar para ver os managers em falta';
        el.onclick = () => showMissingManagersList(sport);
        ensureStatusCorner().appendChild(el);
        window._zoeAutoMsgStatusEl = el;
        return el;
    }

    async function scheduleAutoMessage(sport, skipRound) {
        const settings = getClashSettings(sport);
        if (!settings.autoMessage || !(settings.autoMessageTemplate && settings.autoMessageTemplate.trim())) {
            console.log('ZOE AutoMsg: desativado');
            if (window._zoeAutoMsgTimer) { clearTimeout(window._zoeAutoMsgTimer); window._zoeAutoMsgTimer = null; }
            if (window.location.search.includes('p=federations')) {
                ensureAutoMsgStatusEl(sport).textContent = t('automessageInactive');
            }
            return;
        }
        const offsetHours = settings.autoMessageBefore || 24;
        const offsetMs = offsetHours * 3600000;
        // a data de referência da automensagem passa a ser o FIM da jornada atual,
        // detetado no topo da página do Clash (?p=federations&sub=clash)
        const clashDeadline = await fetchClashDeadlineEnd(sport);
        let nextRound = await fetchNextRoundData(sport);
        if (!nextRound) {
            console.log('ZOE AutoMsg: não foi possível obter os dados do calendário');
            if (!clashDeadline) {
                console.log('ZOE AutoMsg: também sem deadline do Clash, desativar');
                return;
            }
            // fallback: apenas com o deadline do Clash conseguimos agendar
            nextRound = { round: 0, ts: clashDeadline, season: '', division: '', rivalId: null, cid: null, rivalName: '', allRounds: [] };
        }
        const calRoundTs = nextRound.ts;
        if (clashDeadline) {
            console.log('ZOE AutoMsg: a usar deadline do fim da jornada como referência:', new Date(clashDeadline).toLocaleString());
            nextRound = Object.assign({}, nextRound, { ts: clashDeadline });
        }
        if (skipRound && nextRound.round === skipRound) {
            console.log('ZOE AutoMsg: jornada #' + nextRound.round + ' ja tem mensagem, a aguardar próxima...');
            const allR = nextRound.allRounds || [];
            const skipIdx = allR.findIndex(r => r.round === skipRound);
            let nextMs = null;
            if (skipIdx >= 0 && skipIdx < allR.length - 1) {
                const fol = allR[skipIdx + 1];
                nextMs = fol.ts - offsetMs;
                console.log('ZOE AutoMsg: próxima jornada real: #' + fol.round + ' ' + new Date(fol.ts).toLocaleString());
            } else {
                nextMs = nextRound.ts + (7 * 86400000) - offsetMs;
                console.log('ZOE AutoMsg: a usar fallback +7 dias para próxima jornada');
            }
            const delay2 = nextMs - Date.now();
            if (delay2 > 60000) {
                const fmt2 = (ms) => { const h = Math.floor(ms / 3600000); const min = Math.floor((ms % 3600000) / 60000); return h + ':' + String(min).padStart(2, '0') + 'h'; };
                console.log('ZOE AutoMsg: reagendado para daqui ' + fmt2(delay2));
                if (window._zoeAutoMsgTimer) clearTimeout(window._zoeAutoMsgTimer);
                window._zoeAutoMsgTimer = setTimeout(() => { executeAutoMessage(sport, true); }, delay2);
                if (window.location.search.includes('p=federations')) {
                    ensureAutoMsgStatusEl(sport).textContent = t('automessagePrefix') + fmt2(delay2) + t('automessageUntil');
                }
            }
            return;
        }
        const sentSt0 = getAutoMsgSentState(sport);
        if (!skipRound && !(sentSt0 && sentSt0.round === nextRound.round)) {
            const skipInfo = getAutoMsgSkipRound(sport);
            if (skipInfo && skipInfo.round === nextRound.round) {
                const skipDate = skipInfo.roundTs;
                const curDate = calRoundTs;
                if (skipDate && curDate && Math.abs(skipDate - curDate) > 3600000) {
                    console.log('ZOE AutoMsg: skip da jornada #' + nextRound.round + ' pertence a outra época (datas diferentes), a limpar...');
                    GM_setValue('zoe_automessage_skip_' + sport, 'null');
                } else {
                    console.log('ZOE AutoMsg: jornada #' + nextRound.round + ' cancelada pelo utilizador, a aguardar próxima...');
                    await scheduleAutoMessage(sport, nextRound.round);
                    return;
                }
            }
        }
        const nextRoundMs = nextRound.ts;
        const nowMs = Date.now();
        let triggerMs = nextRoundMs - offsetMs;
        let forceSend = false;
        let isDefer = false;
        if (triggerMs <= nowMs) {
            if (nextRoundMs > nowMs || (nowMs - nextRoundMs) < 86400000) {
                console.log('ZOE AutoMsg: janela passou mas jornada ainda relevante, a verificar...');
                const sentState = getAutoMsgSentState(sport);
                if (sentState && sentState.round === nextRound.round) {
                    console.log('ZOE AutoMsg: já enviada, reagendar...');
                    await scheduleAutoMessage(sport, sentState.round);
                    return;
                }
                const deferUntil = getAutoMsgDeferUntil(sport, nextRound.round);
                if (deferUntil > nowMs) {
                    console.log('ZOE AutoMsg: adiado até', new Date(deferUntil).toLocaleTimeString());
                    triggerMs = deferUntil;
                    forceSend = false;
                    isDefer = true;
                } else {
                    triggerMs = nowMs;
                    forceSend = true;
                }
            } else {
                console.log('ZOE AutoMsg: fora da janela, a aguardar próxima...');
                const nextAfter = getNextRoundFromList(nextRound.allRounds, nextRound.round);
                triggerMs = nextAfter ? nextAfter.ts - offsetMs : nextRoundMs + (7 * 86400000) - offsetMs;
            }
        }
        const delay = triggerMs - nowMs;
        if (delay < 60000 && !forceSend && !isDefer) {
            console.log('ZOE AutoMsg: menos de 1 minuto, ignorar');
            return;
        }
        const fmt = (ms) => { const h = Math.floor(ms / 3600000); const min = Math.floor((ms % 3600000) / 60000); return h + ':' + String(min).padStart(2, '0') + 'h'; };
        if (!forceSend) console.log('ZOE AutoMsg: agendado para', new Date(triggerMs).toLocaleString(), '(daqui ' + fmt(delay) + ')');
        if (window._zoeAutoMsgTimer) clearTimeout(window._zoeAutoMsgTimer);
        if (forceSend) {
            console.log('ZOE AutoMsg: a enviar agora...');
            await executeAutoMessage(sport, true);
            return;
        }
        window._zoeAutoMsgTimer = setTimeout(() => { executeAutoMessage(sport, true); }, delay);
        if (window.location.search.includes('p=federations')) {
            ensureAutoMsgStatusEl(sport).textContent = t('automessagePrefix') + fmt(delay) + t('automessageUntil');
        }
    }

    async function executeAutoMessage(sport, fromAuto, selectedUids) {
        if (window.__zoeAutoMsgSendInFlight) {
            console.log('ZOE AutoMsg: envio já em curso noutro processo, a ignorar para evitar duplicados/ordem trocada');
            return;
        }
        window.__zoeAutoMsgSendInFlight = true;
        const autoMsgLogStartSeq = zoeLogSeq;
        const autoMsgStartedAt = Date.now();
        let autoMsgAttempted = false;
        let autoMsgError = null;
        let autoMsgRound = null;
        let autoMsgPageInfo = null;
        let autoMsgRivalId = null;
        let autoMsgTotal = 0;
        let autoMsgSentOk = 0;
        let autoMsgFailed = 0;
        let autoMsgSuccessNames = [];
        let autoMsgFailNames = [];
        let autoMsgPartial = false;
        const settings = getClashSettings(sport);
        if (!settings.autoMessage || !(settings.autoMessageTemplate && settings.autoMessageTemplate.trim())) {
            console.log('ZOE AutoMsg: desativado');
            window.__zoeAutoMsgSendInFlight = false;
            return;
        }
                if (fromAuto) {
                        if (!acquireRunLock()) {
                console.log('ZOE AutoMsg: outro separador está a enviar, a saltar');
                window.__zoeAutoMsgSendInFlight = false;
                return;
            }
            startRunLockHeartbeat();
        }
        try {
            const nextRound = await fetchNextRoundData(sport);
            if (!nextRound) { console.log('ZOE AutoMsg: sem dados, abortar envio'); return; }
            autoMsgRound = nextRound.round;
            autoMsgRivalId = nextRound.rivalId || null;
            const sent = getAutoMsgSentState(sport);
            if (sent && sent.round === nextRound.round) {
                console.log('ZOE AutoMsg: jornada #' + nextRound.round + ' já enviada, a reagendar...');
                await scheduleAutoMessage(sport, nextRound.round);
                return;
            }
            const members = await fetchClashMissingManagers(sport, nextRound);
            if (!members) {
                console.log('ZOE AutoMsg: lista de membros indisponível, a tentar mais tarde');
                await scheduleAutoMessage(sport).catch(function(err) { console.log('ZOE AutoMsg: erro ao reagendar:', err); });
                return;
            }
            const round = nextRound.round;
            const alreadySentUids = getAutoMsgSentManagers(sport, round);
            let missing = members.missing.filter(m => alreadySentUids.indexOf(m.uid) < 0);
            const allMissingUids = missing.map(m => m.uid);
            if (selectedUids && selectedUids.length) {
                const sel = new Set(selectedUids);
                missing = missing.filter(m => sel.has(m.uid));
            }
            if (members.missing.length === 0) {
                console.log('ZOE AutoMsg: todos os managers já jogaram, a saltar para a próxima jornada');
                await scheduleAutoMessage(sport, round);
                return;
            }
            if (missing.length === 0) {
                if (selectedUids && selectedUids.length) {
                    console.log('ZOE AutoMsg: nenhum manager selecionado, sem envio');
                    await scheduleAutoMessage(sport, round);
                    return;
                }
                console.log('ZOE AutoMsg: todos os managers em falta já receberam mensagem nesta jornada');
                saveAutoMsgSentState(sport, round);
                await scheduleAutoMessage(sport, round);
                return;
            }
            const pageInfo = { round: String(round), season: nextRound.season || '', division: nextRound.division || '', rival: nextRound.rivalName || '' };
            autoMsgPageInfo = pageInfo;
            const template = settings.autoMessageTemplate;
            const decision = await confirmAutoMessageSend(sport, missing, !!fromAuto);
            if (decision === 'defer') {
                console.log('ZOE AutoMsg: adiado 10 minutos, sem enviar');
                saveAutoMsgDefer(sport, round, Date.now() + 600000);
                if (window._zoeAutoMsgTimer) clearTimeout(window._zoeAutoMsgTimer);
                window._zoeAutoMsgTimer = setTimeout(() => { executeAutoMessage(sport, true); }, 600000);
                if (window.location.search.includes('p=federations') && window._zoeAutoMsgStatusEl && window._zoeAutoMsgStatusEl.parentNode) {
                    window._zoeAutoMsgStatusEl.textContent = t('automessageDeferred');
                }
                return;
            }
            if (decision === 'cancel') {
                console.log('ZOE AutoMsg: jornada #' + round + ' cancelada pelo utilizador, não volta a disparar nesta jornada');
                saveAutoMsgSkipRound(sport, round, nextRound.ts);
                await scheduleAutoMessage(sport, round);
                return;
            }
            if (!decision) {
                console.log('ZOE AutoMsg: envio cancelado pelo utilizador');
                await scheduleAutoMessage(sport, round);
                return;
            }
            const confirmUids = Array.isArray(decision) ? decision : null;
            if (confirmUids) {
                const sel = new Set(confirmUids);
                missing = missing.filter(m => sel.has(m.uid));
                if (missing.length === 0) {
                    console.log('ZOE AutoMsg: nenhum manager selecionado na confirmação, sem envio');
                    await scheduleAutoMessage(sport, round);
                    return;
                }
            }
            const partialSend = !!((selectedUids && selectedUids.length) || (confirmUids && confirmUids.length)) && missing.length !== allMissingUids.length;
            autoMsgPartial = partialSend;
            const managerNames = missing.map(m => m.name).join('\n');
            const sentNow = getAutoMsgSentState(sport);
            if (sentNow && sentNow.round === round) {
                console.log('ZOE AutoMsg: já enviada noutro separador, a reagendar...');
                await scheduleAutoMessage(sport, round);
                return;
            }
            const whitelistUids = new Set(members.all.map(m => m.uid));
            const amsgStatusEl = ensureAutoMsgStatusEl(sport);
            const totalToSend = missing.length;
            autoMsgAttempted = true;
            autoMsgTotal = totalToSend;
            autoMsgSentOk = 0;
            autoMsgFailed = 0;
            autoMsgSuccessNames = [];
            autoMsgFailNames = [];
            for (const m of missing) {
                if (amsgStatusEl) amsgStatusEl.textContent = t('automessageSending') + (autoMsgSentOk + autoMsgFailed + 1) + '/' + totalToSend + t('automessageOf') + m.name + '...';
                if (!whitelistUids.has(m.uid)) {
                    console.warn('ZOE AutoMsg: ' + m.name + ' não está na lista de membros da federação, a saltar');
                    autoMsgFailed++; autoMsgFailNames.push(m.name);
                    continue;
                }
                const sentNow2 = getAutoMsgSentState(sport);
                if (sentNow2 && sentNow2.round === round) {
                    console.log('ZOE AutoMsg: jornada já enviada noutro separador, a abortar envio');
                    break;
                }
                if (getAutoMsgSentManagers(sport, round).indexOf(m.uid) >= 0) {
                    console.log('ZOE AutoMsg: ' + m.name + ' já recebeu mensagem noutro separador, a saltar');
                    continue;
                }
                const msg = buildGuestbookMessage(template, pageInfo, null, '', [], false, null).replace(/\*managers\*/g, managerNames).replace(/\*name\*/g, m.name);
                if (!msg || !msg.trim()) { console.warn('ZOE AutoMsg: mensagem vazia para ' + m.name); autoMsgFailed++; autoMsgFailNames.push(m.name); continue; }
                const ok = await sendPrivateMessage(sport, m.name, m.uid, msg);
                if (ok) { autoMsgSentOk++; autoMsgSuccessNames.push(m.name); markAutoMsgManagerSent(sport, round, m.uid); } else { autoMsgFailed++; autoMsgFailNames.push(m.name); }
                if (amsgStatusEl) {
                    let txt = t('automessageSent') + autoMsgSentOk + '/' + totalToSend + t('automessageSentCount');
                    if (autoMsgFailed > 0) txt += t('automessageFailed') + autoMsgFailed + t('automessageFailedCount');
                    amsgStatusEl.textContent = txt;
                }
                await new Promise(r => setTimeout(r, 1500));
            }
            console.log('ZOE AutoMsg: concluído — enviadas = ' + autoMsgSentOk + ', falhadas = ' + autoMsgFailed);
            showAutoMessageResult(sport, autoMsgSentOk, autoMsgFailed, autoMsgSuccessNames, autoMsgFailNames);
            if (autoMsgFailed === 0 && !partialSend) {
                saveAutoMsgSentState(sport, round);
            } else {
                console.log('ZOE AutoMsg: houve falhas ou envio parcial, jornada fica por marcar para poder retentar os que faltam');
            }
            await scheduleAutoMessage(sport, round);
        } catch(e) {
            autoMsgError = e && e.message ? e.message : String(e);
            console.error('ZOE AutoMsg: erro ao enviar:', autoMsgError);
            await scheduleAutoMessage(sport).catch(function(err) { console.log('ZOE AutoMsg: erro ao reagendar:', err); });
        } finally {
            window.__zoeAutoMsgSendInFlight = false;
            if (fromAuto) releaseRunLock();
            if (autoMsgAttempted || autoMsgError) {
                try {
                    const autoMsgStatus = autoMsgError ? 'error' : ((autoMsgFailed > 0 || autoMsgPartial) ? 'partial' : 'done');
                    const autoMsgEntries = zoeLogBuffer.filter(entry => entry.seq > autoMsgLogStartSeq);
                    void sendClashDiagnosticLog({
                        version: SCRIPT_VERSION,
                        timestamp: new Date().toISOString(),
                        username: detectCurrentUser() || '',
                        sport: sport,
                        ourId: (typeof getOurFedId === 'function' ? getOurFedId() : null),
                        rivalId: autoMsgRivalId,
                        autoRun: !!fromAuto,
                        trigger: fromAuto ? 'auto' : 'manual',
                        outcome: autoMsgStatus,
                        pageInfo: autoMsgPageInfo,
                        language: getLanguage(),
                        image: { generated: false, plain: false, stats: false, urlPlain: null, urlStats: null },
                        guestbookPosted: null,
                        chat: { status: 'not-attempted' },
                        autoMessage: {
                            attempted: autoMsgAttempted,
                            status: autoMsgStatus,
                            round: autoMsgRound,
                            total: autoMsgTotal,
                            sent: autoMsgSentOk,
                            failed: autoMsgFailed,
                            successNames: autoMsgSuccessNames,
                            failNames: autoMsgFailNames,
                            partialSend: autoMsgPartial,
                            fromAuto: !!fromAuto,
                            selectedUids: (selectedUids && selectedUids.length) ? selectedUids : null,
                            error: autoMsgError
                        },
                        error: autoMsgError,
                        timings: { autoMessage: Date.now() - autoMsgStartedAt },
                        userAgent: navigator.userAgent,
                        pageUrl: location.href,
                        entries: autoMsgEntries
                    });
                } catch(logErr) {
                    console.warn('ZOE AutoMsg: erro ao preparar log remoto:', logErr && logErr.message ? logErr.message : logErr);
                }
            }
        }
    }

    async function testChatMessages(sport) {
        // teste sem envio: mostra as mensagens exatas que o Chat enviaria a cada manager
        const settings = getClashSettings(sport);
        const template = settings.chatTemplate;
        const doc = document;
        const esc = (n) => String(n || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const overlay = doc.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000001;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center';
        const box = doc.createElement('div');
        box.style.cssText = 'background:#1a1a2e;border:2px solid #ff9800;border-radius:10px;padding:16px 10px;font-family:Arial,sans-serif;color:#eee;font-size:12px;width:90%;max-width:560px;max-height:85vh;overflow-y:auto;box-shadow:0 4px 24px rgba(0,0,0,0.7)';
        box.innerHTML = '<div style="display:flex;align-items:center;margin-bottom:12px;position:relative"><b style="font-size:14px;color:#ff9800;width:100%;text-align:center">Pré-vizualização do Chat (sem envio)</b><span id="zoe-chat-test-x" style="cursor:pointer;font-size:16px;color:#999;position:absolute;right:0;top:0">&times;</span></div>';
        box.innerHTML += '<div id="zoe-chat-test-body" style="font-size:12px;color:#888">A preparar pré-vizualização...</div>';
        overlay.appendChild(box);
        doc.body.appendChild(overlay);
        const close = () => overlay.remove();
        box.querySelector('#zoe-chat-test-x').onclick = close;
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
        const body = box.querySelector('#zoe-chat-test-body');
        try {
            if (!template || !template.trim()) {
                body.innerHTML = '<div style="color:#f44336">Escreve o template do Chat antes de testar.</div>';
                return;
            }
            const nextRound = await fetchNextRoundData(sport);
            if (!nextRound) {
                body.innerHTML = '<div style="color:#f44336">Não foi possível obter os dados da jornada.</div>';
                return;
            }
            const members = await fetchChatTargetManagers(sport, nextRound);
            if (!members || !members.length) {
                body.innerHTML = '<div style="color:#f44336">Nenhum manager detetado. Estás na página correta do ManagerZone?</div>';
                return;
            }
            // obter os dados dos confrontos (statsxente) tal como no fluxo real
            let eloRows = [];
            try {
                const ids = deriveClashFedIds(nextRound);
                const ourId = ids.ourId || getOurFedId();
                const rivalId = ids.rivalId || (nextRound.rivalId || null);
                console.log('ZOE Chat: [teste] IDs para statsxente — ourId=' + ourId + ', rivalId=' + rivalId);
                if (ourId && rivalId) {
                    const now = Date.now();
                    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
                    const apiUrl = 'https://statsxente.com/MZ1/Functions/loadClashMatcher.php?fid=' + ourId + '&fid1=' + rivalId + '&idioma=PORTUGUES&divisa=EUR&sport=' + sport + '&type=' + settings.clashType + '&start_date=' + thirtyDaysAgo + '&final_date=' + now + '&limit=3&teams_offered=' + (settings.clashType === 'offer' ? settings.teamsOffered : 0);
                    const tableHtml = await new Promise((resolve) => {
                        GM_xmlhttpRequest({
                            method: 'GET', url: apiUrl, timeout: 15000,
                            onload: (r) => resolve(r.responseText || ''),
                            onerror: () => resolve(''), ontimeout: () => resolve('')
                        });
                    });
                    console.log('ZOE Chat: [teste] resposta statsxente length = ' + (tableHtml ? tableHtml.length : 0));
                    eloRows = parseClashMatchupTable(tableHtml);
                    console.log('ZOE Chat: [teste] confrontos statsxente = ' + eloRows.length);
                } else {
                    console.warn('ZOE Chat: [teste] sem IDs para statsxente (ourId=' + ourId + ', rivalId=' + rivalId + ')');
                }
            } catch(e) {
                console.warn('ZOE Chat: [teste] sem dados de confrontos:', e.message);
            }
            const pageInfo = { round: String(nextRound.round), season: nextRound.season || '', division: nextRound.division || '', rival: nextRound.rivalName || '' };
            const managerNames = members.map(m => m.name).join('\n');
            let html = '<div style="margin-bottom:8px;color:#eee">Enviaria a <b>' + members.length + '</b> manager(s):</div>';
            let withRow = 0, withoutRow = 0;
            for (const m of members) {
                const row = (eloRows || []).find(r => r.user === m.name);
                if (row) withRow++; else withoutRow++;
                const msg = buildChatMessage(template, pageInfo, row, m.name, managerNames);
                html += '<div style="background:#16213e;border:1px solid #555;border-radius:6px;padding:6px 8px;margin-bottom:6px">';
                html += '<div style="color:#ffc107;font-weight:bold;margin-bottom:4px">→ ' + esc(m.name) + (m.team ? ' (' + esc(m.team) + ')' : '') + (row ? '' : ' <span style="color:#f44336;font-weight:normal">(sem confronto detetado — códigos *user* vazios)</span>') + '</div>';
                html += '<pre style="white-space:pre-wrap;word-break:break-word;margin:0;font-size:11px;color:#ddd;font-family:Consolas,monospace">' + esc(msg) + '</pre>';
                html += '</div>';
            }
            html += '<div style="font-size:11px;color:#888;margin-top:8px">Managers com confronto na statsxente: <b>' + withRow + '</b> | sem confronto: <b>' + withoutRow + '</b>. Isto é apenas um teste — nenhuma mensagem foi enviada.</div>';
            body.innerHTML = html;
            console.log('ZOE Chat: [teste] pré-visualização gerada para', members.length, 'managers (sem envio)');
        } catch(e) {
            console.error('ZOE Chat: [teste] erro:', e.message);
            body.innerHTML = '<div style="color:#f44336">Erro no teste: ' + esc(e.message) + '</div>';
        }
    }

    async function executeChatSend(sport, pageInfo, eloRows, ourId) {
        const t0 = Date.now();
        const runId = 'chat-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
        const log = (msg) => console.log('ZOE Chat[' + runId + ']: ' + msg);
        const warn = (msg) => console.warn('ZOE Chat[' + runId + ']: ' + msg);
        const settings = getClashSettings(sport);
        log('START | sport=' + sport + ' | pageInfo=' + JSON.stringify(pageInfo || null) + ' | ourId=' + ourId + ' | chatToManagers=' + !!settings.chatToManagers + ' | templateLen=' + String(settings.chatTemplate || '').length + ' | inFlight=' + !!window.__zoeChatSendInFlight + ' | visibility=' + document.visibilityState);
        if (!settings.chatToManagers || !(settings.chatTemplate && settings.chatTemplate.trim())) {
            log('desativado (checkbox ou template vazio)');
            return { status: 'disabled' };
        }
        if (window.__zoeChatSendInFlight) {
            log('envio já em curso noutro processo, a ignorar para evitar duplicados/ordem trocada');
            return { status: 'in-flight' };
        }
        window.__zoeChatSendInFlight = true;
        try {
            const tr = Date.now();
            const nextRound = await fetchNextRoundData(sport);
            log('fetchNextRoundData em ' + (Date.now() - tr) + 'ms → ' + (nextRound ? JSON.stringify({ round: nextRound.round, ts: nextRound.ts, season: nextRound.season, division: nextRound.division, rivalId: nextRound.rivalId, rivalName: nextRound.rivalName }) : 'null'));
            const round = pageInfo && pageInfo.round ? parseInt(pageInfo.round, 10) : (nextRound ? nextRound.round : null);
            if (!round) { warn('sem jornada, abortar envio'); return { status: 'no-round' }; }
            const sent = getChatSentState(sport);
            log('round=' + round + ' | sentState=' + JSON.stringify(sent) + ' | alreadySentUids=' + JSON.stringify(getChatSentManagers(sport, round)));
            if (sent && sent.round === round) {
                log('mensagens já enviadas nesta jornada #' + round + ', sem novo envio');
                return { status: 'already-sent', round: round };
            }
            const tm = Date.now();
            const members = await fetchChatTargetManagers(sport, nextRound);
            log('fetchChatTargetManagers em ' + (Date.now() - tm) + 'ms → ' + (members ? members.length : 0) + ' managers' + (members && members.length ? ' | ' + JSON.stringify(members.slice(0, 20).map(m => ({ uid: m.uid, name: m.name, team: m.team, isMain: !!m.isMain }))) : ''));
            if (!members || !members.length) {
                warn('sem managers detetados, sem envio');
                return { status: 'no-members' };
            }
            const alreadySentUids = getChatSentManagers(sport, round);
            let targets = members.filter(m => alreadySentUids.indexOf(m.uid) < 0);
            log('targets após alreadySent=' + targets.length + ' | ' + JSON.stringify(targets.map(m => m.name + '#' + m.uid)));
            if (!targets.length) {
                log('todos os managers já receberam a mensagem nesta jornada');
                return { status: 'all-sent', round: round };
            }
            const tc = Date.now();
            const decision = await confirmAutoMessageSend(sport, targets, false, true);
            log('confirmAutoMessageSend em ' + (Date.now() - tc) + 'ms → ' + JSON.stringify(decision));
            if (decision === 'defer' || decision === 'cancel' || !decision) {
                log('envio cancelado pelo utilizador');
                return { status: 'cancelled' };
            }
            const confirmUids = Array.isArray(decision) ? decision : null;
            if (confirmUids) {
                const sel = new Set(confirmUids);
                targets = targets.filter(m => sel.has(m.uid));
                log('targets após confirmação=' + targets.length + ' | ' + JSON.stringify(targets.map(m => m.name + '#' + m.uid)));
                if (!targets.length) {
                    log('nenhum manager selecionado na confirmação, sem envio');
                    return { status: 'none-selected', round: round };
                }
            }
            const managerNames = targets.map(m => m.name).join('\n');
            const whitelistUids = new Set(members.map(m => m.uid));
            const chatStatusEl = document.getElementById('zoe-status');
            const totalToSend = targets.length;
            let sentOk = 0, failed = 0;
            const successNames = [], failNames = [];
            log('INÍCIO ENVIO | total=' + totalToSend + ' | managerNamesLen=' + managerNames.length + ' | whitelist=' + whitelistUids.size);
            for (let idx = 0; idx < targets.length; idx++) {
                const m = targets[idx];
                const mt = Date.now();
                log('manager ' + (idx + 1) + '/' + totalToSend + ' START | ' + m.name + '#' + m.uid + ' | isMain=' + !!m.isMain + ' | team=' + (m.team || ''));
                if (chatStatusEl) chatStatusEl.textContent = t('chatSendingProgress') + ' ' + (sentOk + failed + 1) + t('chatSendingOf') + totalToSend + t('chatSendingTo') + m.name + '...';
                if (!whitelistUids.has(m.uid)) {
                    warn('manager ' + (idx + 1) + ' | ' + m.name + ' não está na lista de membros da federação, a saltar');
                    failed++; failNames.push(m.name);
                    continue;
                }
                if (getChatSentManagers(sport, round).indexOf(m.uid) >= 0) {
                    log('manager ' + (idx + 1) + ' | ' + m.name + ' já recebeu mensagem noutro separador, a saltar');
                    continue;
                }
                const row = (eloRows || []).find(r => r.user === m.name);
                log('manager ' + (idx + 1) + ' | rowMatch=' + (row ? 'sim' : 'não') + ' | eloRows=' + ((eloRows || []).length));
                const msg = buildChatMessage(settings.chatTemplate, pageInfo, row, m.name, managerNames);
                log('manager ' + (idx + 1) + ' | mensagem len=' + String(msg || '').length + ' | linhas=' + String(msg || '').split(/\r?\n/).filter(l => l.trim()).length + ' | primeira="' + String(msg || '').split(/\r?\n/)[0].slice(0, 100) + '"');
                if (!msg || !msg.trim()) { warn('manager ' + (idx + 1) + ' | mensagem vazia para ' + m.name); failed++; failNames.push(m.name); continue; }
                const ok = await sendPrivateMessage(sport, m.name, m.uid, msg, { runId: runId, index: idx + 1, total: totalToSend });
                log('manager ' + (idx + 1) + ' FIM | ' + m.name + ' | ok=' + ok + ' | duração=' + (Date.now() - mt) + 'ms');
                if (ok) { sentOk++; successNames.push(m.name); markChatManagerSent(sport, round, m.uid); log('manager ' + (idx + 1) + ' | markChatManagerSent(' + m.uid + ') → ' + JSON.stringify(getChatSentManagers(sport, round))); }
                else { failed++; failNames.push(m.name); }
                if (chatStatusEl) {
                    let txt = 'Enviadas ' + sentOk + '/' + totalToSend + ' mensagens';
                    if (failed > 0) txt += ' (' + failed + ' falharam)';
                    chatStatusEl.textContent = txt;
                }
                await new Promise(r => setTimeout(r, 1500));
            }
            log('FIM ENVIO | enviadas=' + sentOk + ' | falhadas=' + failed + ' | success=' + JSON.stringify(successNames) + ' | fail=' + JSON.stringify(failNames) + ' | total=' + (Date.now() - t0) + 'ms');
            showAutoMessageResult(sport, sentOk, failed, successNames, failNames);
            if (failed === 0 && sentOk > 0) {
                saveChatSentState(sport, round);
                log('saveChatSentState(' + round + ') guardado');
            } else {
                log('houve falhas, jornada fica por marcar para poder retentar os que faltam');
            }
            return { status: 'done', round: round, total: totalToSend, sent: sentOk, failed: failed, successNames: successNames, failedNames: failNames };
        } catch(e) {
            console.error('ZOE Chat[' + runId + ']: ERRO FATAL: ' + (e && e.stack ? e.stack : e));
            return { status: 'error', message: e && e.message ? e.message : String(e) };
        } finally {
            window.__zoeChatSendInFlight = false;
            log('finally | inFlight=false | duração total=' + (Date.now() - t0) + 'ms');
        }
    }

    function showChatTestNotice(message) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000006;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center';
        const modal = document.createElement('div');
        modal.style.cssText = 'background:#1a1a2e;border:2px solid #f44336;border-radius:10px;padding:16px 10px;font-family:Arial,sans-serif;color:#eee;font-size:13px;width:85%;max-width:420px;box-shadow:0 4px 24px rgba(0,0,0,0.7)';
        modal.innerHTML = '<div style="text-align:center;margin-bottom:12px"><b style="font-size:14px;color:#f44336">Teste de Chat</b></div><div style="font-size:12px;color:#ddd;line-height:1.5">' + String(message || '') + '</div><div style="display:flex;justify-content:flex-end;margin-top:12px"><button id="zoe-chat-test-notice-ok" style="background:#f44336;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">OK</button></div>';
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        modal.querySelector('#zoe-chat-test-notice-ok').onclick = close;
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    }

    function runSingleChatTest() {
        if (window.__zoeChatTestInFlight) {
            showChatTestNotice('Já está um teste de chat em curso.');
            return;
        }
        if (window.__zoeChatSendInFlight || window.__zoeAutoMsgSendInFlight || startClashScreenshotFlow._running) {
            showChatTestNotice('Já existe um processo em curso (imagem, auto-mensagem ou chat). Tenta novamente quando terminar.');
            return;
        }
        window.__zoeChatTestInFlight = true;
        const doc = document;
        const sport = detectCurrentSport();
        const target = getChatTestTarget();
        const targetUid = target.uid;
        const targetName = target.name;
        const targetInfo = targetName + ' (uid ' + targetUid + ')';
        const message = 'Teste Chat';
        const runId = 'chat-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
        const startedAt = Date.now();
        const startSeq = zoeLogSeq;
        const accent = getSportAccent(sport);
        const overlay = doc.createElement('div');
        overlay.id = 'zoe-chat-test-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000006;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center';
        const modal = doc.createElement('div');
        modal.style.cssText = 'background:#1a1a2e;border:2px solid ' + accent + ';border-radius:10px;padding:16px 10px;font-family:Arial,sans-serif;color:#eee;font-size:13px;width:85%;max-width:440px;max-height:80vh;overflow-y:auto;box-shadow:0 4px 24px rgba(0,0,0,0.7)';
        modal.innerHTML = '<div style="display:flex;align-items:center;margin-bottom:12px;position:relative"><b id="zoe-chat-test-title" style="font-size:14px;color:' + accent + ';width:100%;text-align:center">Teste de Chat</b><span id="zoe-chat-sendtest-x" style="cursor:pointer;font-size:16px;color:#999;position:absolute;right:0;top:0">&times;</span></div>';
        modal.innerHTML += '<div id="zoe-chat-sendtest-body" style="font-size:12px;color:#ddd;line-height:1.5">A enviar <b>"Teste Chat"</b> para <b>' + targetName + '</b> (uid ' + targetUid + ')...</div>';
        modal.innerHTML += '<div id="zoe-chat-test-log" style="font-size:11px;color:#888;margin-top:8px"></div>';
        modal.innerHTML += '<div id="zoe-chat-test-actions" style="display:none;justify-content:flex-end;align-items:center;margin-top:12px"><button id="zoe-chat-test-ok" style="background:' + accent + ';color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">OK</button></div>';
        overlay.appendChild(modal);
        doc.body.appendChild(overlay);
        const close = () => overlay.remove();
        modal.querySelector('#zoe-chat-sendtest-x').onclick = close;
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
        const body = modal.querySelector('#zoe-chat-sendtest-body');
        const logEl = modal.querySelector('#zoe-chat-test-log');
        const actions = modal.querySelector('#zoe-chat-test-actions');
        const okBtn = modal.querySelector('#zoe-chat-test-ok');
        okBtn.onclick = close;
        const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        (async () => {
            let ok = false;
            let error = null;
            try {
                console.log('ZOE Chat Test[' + runId + ']: START | currentUser=' + (detectCurrentUser() || '?') + ' | target=' + targetName + '#' + targetUid + ' | url=https://www.managerzone.com/?p=profile&uid=' + targetUid + ' | message="' + message + '"');
                ok = await sendPrivateMessage(sport, targetName, targetUid, message, { runId: runId, index: 1, total: 1 });
                console.log('ZOE Chat Test[' + runId + ']: FIM | ok=' + ok + ' | duração=' + (Date.now() - startedAt) + 'ms');
            } catch(e) {
                error = e && e.stack ? e.stack : (e && e.message ? e.message : String(e));
                console.error('ZOE Chat Test[' + runId + ']: ERRO: ' + error);
            } finally {
                window.__zoeChatTestInFlight = false;
            }
            const color = ok ? '#4caf50' : '#f44336';
            body.innerHTML = ok
                ? '<div style="color:#4caf50;font-weight:bold;margin-bottom:6px">Mensagem enviada com sucesso.</div><div style="color:#bbb">Destino: ' + targetInfo + '<br>Mensagem: "Teste Chat"</div>'
                : '<div style="color:#f44336;font-weight:bold;margin-bottom:6px">Falha ao enviar a mensagem.</div><div style="color:#bbb">Destino: ' + targetInfo + '<br>Mensagem: "Teste Chat"</div>' + (error ? '<div style="color:#f44336;font-size:11px;margin-top:8px;white-space:pre-wrap">' + esc(error.slice(0, 800)) + '</div>' : '');
            modal.style.borderColor = color;
            const titleEl = modal.querySelector('#zoe-chat-test-title');
            if (titleEl) titleEl.style.color = color;
            actions.style.display = 'flex';
            try {
                const pageInfo = (typeof extractClashPageInfo === 'function' ? extractClashPageInfo() : null) || null;
                const payload = {
                    version: SCRIPT_VERSION,
                    timestamp: new Date().toISOString(),
                    username: detectCurrentUser() || '',
                    sport: sport,
                    ourId: (typeof getOurFedId === 'function' ? getOurFedId() : null),
                    rivalId: null,
                    autoRun: false,
                    pageInfo: pageInfo,
                    language: getLanguage(),
                    test: true,
                    image: { generated: false, plain: false, stats: false, urlPlain: null, urlStats: null },
                    guestbookPosted: null,
                    chat: { status: ok ? 'done' : 'error', test: true, targetUid: targetUid, targetName: targetName, message: message, sent: ok ? 1 : 0, failed: ok ? 0 : 1 },
                    error: ok ? null : (error || 'Falha no teste de chat'),
                    timings: { testChat: Date.now() - startedAt },
                    userAgent: navigator.userAgent,
                    pageUrl: location.href,
                    entries: zoeLogBuffer.filter(entry => entry.seq > startSeq)
                };
                logEl.textContent = 'A enviar log para o Sheets...';
                void sendClashDiagnosticLog(payload).then(sent => {
                    logEl.textContent = sent ? 'Log enviado para o Sheets.' : 'O envio do log para o Sheets falhou.';
                    logEl.style.color = sent ? '#4caf50' : '#f44336';
                    console.log('ZOE Chat Test[' + runId + ']: log remoto ' + (sent ? 'enviado' : 'NÃO enviado'));
                });
            } catch(e) {
                logEl.textContent = 'Erro ao preparar o log: ' + (e && e.message ? e.message : e);
                logEl.style.color = '#f44336';
                console.warn('ZOE Chat Test[' + runId + ']: erro ao preparar log remoto: ' + (e && e.message ? e.message : e));
            }
        })();
    }

    // --- Init ---

    function init() {
        if (window.self !== window.top) {
            console.log('ZOE: a correr dentro de um iframe, sem agendamento automático');
            return;
        }
        if (window.location.search.includes('p=federations') && !window.location.search.includes('fid=') && !window.location.search.includes('id=') && !window.location.search.includes('sub=')) {
            detectFedIdFromHash();
        }
        injectClashIcon();
        const sport = detectCurrentSport();

        // DEBUG (pode remover em produção): expõe helpers para testar o fallback na consola.
        // Ex.:  await ZoeDebug.resolveStandings('soccer')   -> {ourId, rivalId} ou null
        //       await ZoeDebug.fetchStandings('soccer', true) -> fids da página prev=1
        //       await ZoeDebug.fetchStandings('soccer', false) -> fids da página atual
        window.ZoeDebug = {
            resolveStandings: (s) => resolveOurFedIdViaStandings(s || sport),
            fetchStandings: (s, prev) => fetchStandingsFids(s || sport, prev),
            extract: (html) => extractStandingsFids(html)
        };
        if (window.location.search.includes('zoe_selftest=1')) {
            console.log('ZOE DEBUG selftest: a testar fallback standings para sport=' + sport);
            (async () => {
                try {
                    const prev = await fetchStandingsFids(sport, true);
                    const cur = await fetchStandingsFids(sport, false);
                    console.log('ZOE DEBUG selftest: fids prev=1 =', prev);
                    console.log('ZOE DEBUG selftest: fids atual  =', cur);
                    const fb = await resolveOurFedIdViaStandings(sport);
                    console.log('ZOE DEBUG selftest: resultado =', JSON.stringify(fb));
                    if (fb && fb.ourId && fb.rivalId) console.log('ZOE DEBUG selftest: MATCH encontrado (ourId=' + fb.ourId + ', rivalId=' + fb.rivalId + ')');
                    else console.log('ZOE DEBUG selftest: SEM MATCH — o erro seria mantido');
                } catch (e) {
                    console.error('ZOE DEBUG selftest: erro =', e.message);
                }
            })();
        }

        setTimeout(() => { scheduleAutoRun(sport).catch(function(e) { console.log('ZOE AutoRun: erro ao agendar:', e); }); }, 3000);
        setTimeout(() => { scheduleAutoMessage(sport).catch(function(e) { console.log('ZOE AutoMsg: erro ao agendar:', e); }); }, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
