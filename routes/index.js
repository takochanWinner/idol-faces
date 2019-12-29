// node のコアモジュールのhttpを使う
const   fs          = require('fs'),
        multer      = require('multer'),
        DIR         = require("app-root-path"),
        AWS         = require('aws-sdk');
// AWS関連の設定値
const   BUCKET       = 'comperison-faces',
        COLLECTION   = 'imas-million';

var localFilePath;
var express = require('express');
var router = express.Router();
const app = express();
// AWS認証
AWS.config.loadFromPath(DIR + '/config/aws-config.json');
AWS.config.update({region: 'ap-northeast-1'});
// S3オブジェクト
const s3 = new AWS.S3({apiVersion: '2006-03-01'});

// Rekognitionオブジェクト作成
const rekognition = new AWS.Rekognition();

// ファイル保存方法
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      // 保存パス
      cb(null, DIR +'/tmp')
  },
  filename: (req, file, cb) => {
      // 元のファイル名で保存
      cb(null, file.originalname)
      localFilePath = DIR + '/tmp' + '/' + file.originalname;
  }
});

const upload = multer({ storage: storage});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/upload', upload.single('file'), async(req, res) => {
  // 照合結果を返却
  res.send(await receiveFiles(req));
});

// アイドル名のディクショナリ
const idol_dictionary = {
  "kitazawa-shiho.jpg":"北沢　志保",
  "akitusuki-ritsuko.jpg":"秋月　律子",
  "gahana-hibiki.jpg":"我那覇　響",
  "shiraishi-tsumugi.jpg":"白石　紬",
  "nikaido-chizuru.jpg":"二階堂　千鶴",
  "matsuda-arisa.jpg":"松田　亜利沙",
  "hoshi-miki.jpg":"星井　美希",
  "takatsuki-yayoi.jpg":"高槻　やよい",
  "ogami-tamaki.jpg":"大神　環",
  "tenkubashi-tomoka.jpg":"天空橋　朋花",
  "nakatani-iku.jpg":"中谷　育",
  "maihama-ayumu.jpg":"舞浜　歩",
  "toyokawa-fuka.jpg":"豊川　風花",
  "shiomiya-karen.jpg":"篠宮　可憐",
  "futami-mami.jpg":"双海　真美",
  "suo-momoko.jpg":"周防　桃子",
  "baba-konomi.jpg":"馬場　このみ",
  "tokugawa-matsuri.jpg":"徳川　まつり",
  "yabuki-kana.jpg":"矢吹　可奈",
  "yokoyama-nao.jpg":"横山　奈緒",
  "kasuga-mirai.jpg":"春日　未来",
  "hakozaki-serika.jpg":"箱崎　星梨花",
  "juria.jpg":"ジュリア",
  "handa-michiko.jpg":"ロコ",
  "takayama-sayoko.jpg":"高山　紗代子",
  "shimabara-erena.jpg":"島原　エレナ",
  "sakuramori-kaori.jpg":"桜宮　歌織",
  "futami-ami.jpg":"双海　亜美",
  "kikuchi-makoto.jpg":"菊地　真",
  "mogami-shizuka.jpg":"最上　静香",
  "miyao-miya.jpg":"宮尾　美也",
  "shijo-takane.jpg":"四条　貴音",
  "nanao-yuriko.jpg":"七尾　百合子",
  "momose-rio.jpg":"百瀬　莉緒",
  "minase-iori.jpg":"水瀬　伊織",
  "kinoshita-hinata.jpg":"木下　ひなた",
  "kitakami-reika.jpg":"北上　麗花",
  "ibuki-tsubasa.jpg":"伊吹　翼",
  "amami-haruka.jpg":"天海　春香",
  "emiri.jpg":"エミリー　スチュアート",
  "nonohara-akane.jpg":"野々原　茜",
  "hagiwara-yukiho.jpg":"萩原　雪歩",
  "kousaka-umi.jpg":"高坂　海美",
  "miura-azusa.jpg":"三浦　あずさ",
  "tokoro-megumi.jpg":"所　恵美",
  "makabe-mizuki.jpg":"真壁　瑞希",
  "kisaragi-chihaya.jpg":"如月　千早",
  "tanaka-kotoha.jpg":"田中　琴葉",
  "mochiduki-anna.jpg":"望月　杏奈",
  "fukuda-noriko.jpg":"福田　のり子",
  "satake-minako.jpg":"佐竹　美奈子",
  "nagayoshi-subaru.jpg":"永吉　昴"
};

/** 
 * 1.S3へリクエストされた画像をPUT
 * 2.画像を照合（Rekognitionの実行）
 * 3.結果返却
 * 
 * @param {object} リクエストされた画像情報
 * @return {object} rekognitionの実行結果
 *                  Name: マッチしたアイドルのファイル名
 *                  Similarity: 探したい人の画像との類似性
 *                  JpnName: アイドル名
 */
const receiveFiles = async(req) => {

  // リクエストの画像をS3へPUT
  await s3Put(req);

  // 画像照合
  const searchResults = await imageRekognition(req.file.originalname);

  return searchResults;
}

/** 
 * リクエストされたファイルをS3へPUTする
 * @param {object} リクエストされた画像情報
 */
const s3Put = (req) => {
  return new Promise((resolve, reject) => {
      // S3へのパラメータ
      const s3PutParams = {
          Body: fs.readFileSync(localFilePath), 
          Bucket: BUCKET, 
          Key: req.file.originalname,
          ContentType: req.file.mimetype
      };

      s3.putObject(s3PutParams, (err, data) => {
          if (err) {
              console.log(err, err.stack); // an error occurred
          } else {
              console.log('【INFO】uploaded s3 ' + req.file.originalname); // successful response
              // ローカルのファイル削除
              fs.unlink(localFilePath, (err) => {
                  if (err) {
                      console.log(err, err.stack); // an error occurred
                  } else {
                      console.log('【INFO】deleted local ' + localFilePath); // successful response
                  }
              });
          }
      });
      resolve();
  });
}

/** 
 * 画像パスを渡しRekognitionSDKを実行④
 * @param {string} リクエストされた画像
 * @return {object} rekognitionの実行結果
 *                  Name: マッチしたアイドルのファイル名
 *                  Similarity: 探したい人の画像との類似性
 *                  JpnName: アイドル名
 */
const imageRekognition = async(uploadImage) => {
      // Rekognition実行(promise)
  const result = await execRekognition(uploadImage);

  return result;
};

/** 
 * Rekognitionへのパラメーターをセット
 * @param {string} リクエストされた画像
 * @return {object} rekognitionのへのパラメータ
 */
const setRekognitionParam = (uploadImage) => {
  // Rekognition用パラメータ
  return RekognitionParams = {
      CollectionId: COLLECTION,
      Image: {
          S3Object: {
              Bucket: BUCKET, 
              Name: uploadImage
          }
      },
      MaxFaces: 5,
      FaceMatchThreshold: 1
  };
}

/** 
 * RekognitionSDKを実行③
 * @param {string} リクエストされた画像
 * @return {object} rekognitionで検索した結果
 */
const execRekognition = (uploadImage) => {
  let listResult = [];
  var compareResult = {};
  return new Promise((resolve, reject) => {
      const sendRekognitionParam = setRekognitionParam(uploadImage);

      // 画像比較開始
      rekognition.searchFacesByImage(sendRekognitionParam, (err, data) => {
          if (err) {
              console.log(err);
          } else {
              // 画像として認識されたがunmatch かどうかの判別用
              if (typeof(data.FaceMatches[0]) != 'undefined') {
                data.FaceMatches.forEach(faces => {
                  compareResult = {
                    Name: faces.Face.ExternalImageId,
                    Similarity: faces.Similarity,
                    JpnName: idol_dictionary[faces.Face.ExternalImageId]
                  };
                  listResult.push(compareResult)
                });
              } else {
                  console.log('【ERROR】unmach faces');
              }
          }
          resolve(listResult);
      });
  });
}

module.exports = router;
