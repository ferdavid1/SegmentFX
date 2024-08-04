import sys
import uuid
import pathlib
import os

from metaseg import SegManualMaskPredictor
from PIL import Image
import PyQt5
from PyQt5 import QtCore, QtWidgets
from PyQt5.QtCore import Qt, QObject, QUrl, QRect, pyqtSignal, QPoint, QSize, QBuffer
from PyQt5.QtGui import QPainter, QImage, QFont
from PyQt5.QtWidgets import (QWidget, QApplication, QMainWindow, QGridLayout, QToolBar,
QAction, QPushButton, QStyle, QHBoxLayout, QVBoxLayout, QSlider, QStatusBar)
from PyQt5.QtMultimedia import QMediaPlayer, QMediaContent, QAbstractVideoBuffer, \
    QVideoFrame, QVideoSurfaceFormat, QAbstractVideoSurface
from PyQt5.QtMultimediaWidgets import QVideoWidget


class VideoFrameGrabber(QAbstractVideoSurface):
    frameAvailable = pyqtSignal(QImage)

    def __init__(self, widget: QWidget, parent: QObject):
        super().__init__(parent)

        self.widget = widget

    def supportedPixelFormats(self, handleType):
        return [QVideoFrame.Format_ARGB32, QVideoFrame.Format_ARGB32_Premultiplied,
                QVideoFrame.Format_RGB32, QVideoFrame.Format_RGB24, QVideoFrame.Format_RGB565,
                QVideoFrame.Format_RGB555, QVideoFrame.Format_ARGB8565_Premultiplied,
                QVideoFrame.Format_BGRA32, QVideoFrame.Format_BGRA32_Premultiplied, QVideoFrame.Format_BGR32,
                QVideoFrame.Format_BGR24, QVideoFrame.Format_BGR565, QVideoFrame.Format_BGR555,
                QVideoFrame.Format_BGRA5658_Premultiplied, QVideoFrame.Format_AYUV444,
                QVideoFrame.Format_AYUV444_Premultiplied, QVideoFrame.Format_YUV444,
                QVideoFrame.Format_YUV420P, QVideoFrame.Format_YV12, QVideoFrame.Format_UYVY,
                QVideoFrame.Format_YUYV, QVideoFrame.Format_NV12, QVideoFrame.Format_NV21,
                QVideoFrame.Format_IMC1, QVideoFrame.Format_IMC2, QVideoFrame.Format_IMC3,
                QVideoFrame.Format_IMC4, QVideoFrame.Format_Y8, QVideoFrame.Format_Y16,
                QVideoFrame.Format_Jpeg, QVideoFrame.Format_CameraRaw, QVideoFrame.Format_AdobeDng]

    def isFormatSupported(self, format):
        imageFormat = QVideoFrame.imageFormatFromPixelFormat(format.pixelFormat())
        size = format.frameSize()

        return imageFormat != QImage.Format_Invalid and not size.isEmpty() and \
               format.handleType() == QAbstractVideoBuffer.NoHandle

    def start(self, format: QVideoSurfaceFormat):
        imageFormat = QVideoFrame.imageFormatFromPixelFormat(format.pixelFormat())
        size = format.frameSize()

        if imageFormat != QImage.Format_Invalid and not size.isEmpty():
            self.imageFormat = imageFormat
            self.imageSize = size
            self.sourceRect = format.viewport()

            super().start(format)

            self.widget.updateGeometry()
            self.updateVideoRect()

            return True
        else:
            return False

    def stop(self):
        self.currentFrame = QVideoFrame()
        self.targetRect = QRect()

        super().stop()

        self.widget.update()

    def present(self, frame):
        if frame.isValid():
            cloneFrame = QVideoFrame(frame)
            cloneFrame.map(QAbstractVideoBuffer.ReadOnly)
            image = QImage(cloneFrame.bits(), cloneFrame.width(), cloneFrame.height(),
                           QVideoFrame.imageFormatFromPixelFormat(cloneFrame.pixelFormat()))
            self.frameAvailable.emit(image)  # this is very important
            cloneFrame.unmap()

        if self.surfaceFormat().pixelFormat() != frame.pixelFormat() or \
                self.surfaceFormat().frameSize() != frame.size():
            self.setError(QAbstractVideoSurface.IncorrectFormatError)
            self.stop()

            return False
        else:
            self.currentFrame = frame

            self.widget.repaint(self.targetRect)

            return True

    def updateVideoRect(self):
        size = self.surfaceFormat().sizeHint()
        size.scale(self.widget.size().boundedTo(size), Qt.KeepAspectRatio)

        self.targetRect = QRect(QPoint(0, 0), size)
        self.targetRect.moveCenter(self.widget.rect().center())

    def paint(self, painter):
        if self.currentFrame.map(QAbstractVideoBuffer.ReadOnly):
            oldTransform = self.painter.transform()

        if self.surfaceFormat().scanLineDirection() == QVideoSurfaceFormat.BottomToTop:
            self.painter.scale(1, -1)
            self.painter.translate(0, -self.widget.height())

        image = QImage(self.currentFrame.bits(), self.currentFrame.width(), self.currentFrame.height(),
                       self.currentFrame.bytesPerLine(), self.imageFormat)

        self.painter.drawImage(self.targetRect, image, self.sourceRect)

        self.painter.setTransform(oldTransform)

        self.currentFrame.unmap()


class MainWidget(QMainWindow):
    def __init__(self, parent=None):
        super(MainWidget, self).__init__(parent)

        self.setWindowTitle("SegmentFX")
        self.setAcceptDrops(True)
        self.resizeByScreenSize()

        self.centralWidget = QWidget(self)

        self.gridLayout = QGridLayout(self.centralWidget)
        self.gridLayout.setContentsMargins(0, 0, 0, 0)
        self.gridLayout.setSpacing(0)

        self.video_item = QVideoWidget()

        self.gridLayout.addWidget(self.video_item)

        self.setCentralWidget(self.centralWidget)

        self.mediaPlayer = QMediaPlayer(None, QMediaPlayer.VideoSurface)
        self.media= ""

        btnSize = QSize(16, 16)

        self.playButton = QPushButton()
        self.playButton.setEnabled(False)
        self.playButton.setFixedHeight(48)
        self.playButton.setIconSize(btnSize)
        self.playButton.setIcon(self.style().standardIcon(QStyle.SP_MediaPlay))
        self.playButton.clicked.connect(self.play)

        self.grabber = VideoFrameGrabber(self.video_item, self)

        self.positionSlider = QSlider(Qt.Horizontal)
        self.positionSlider.setRange(0, 0)
        self.positionSlider.sliderMoved.connect(self.setPosition)

        self.statusBar = QStatusBar()
        self.statusBar.setFont(QFont("Helvetica", 7))
        self.statusBar.setFixedHeight(14)

        self.gridLayout.addWidget(self.playButton)
        self.gridLayout.addWidget(self.positionSlider)
        self.gridLayout.addWidget(self.statusBar)
        # self.gridLayout.addWidget(self.grabber)

        # self.mediaPlayer.setVideoOutput(self.grabber)
        self.mediaPlayer.setVideoOutput(self.video_item)

        self.grabber.frameAvailable.connect(self.process_frame)

        self.mediaPlayer.stateChanged.connect(self.mediaStateChanged)
        self.mediaPlayer.positionChanged.connect(self.positionChanged)
        self.mediaPlayer.durationChanged.connect(self.durationChanged)
        self.mediaPlayer.error.connect(self.handleError)

        self.button = QPushButton("Segment", self)
        self.button.setGeometry(200, 150, 100, 40)
        button_position = self.getButtonPosition()
        self.button.move(button_position[0], button_position[1])
        self.button.setCheckable(True)
        self.button.clicked.connect(self.onClick)
        self.button.setStyleSheet("background-color : red")
        self.update()
        # self.show()

        # local = QUrl.fromLocalFile('c:/temp/lorem.mp4')
            
    def getScreenSize(self):
        screen = QApplication.primaryScreen().size()
        partial_screen = (int(screen.width()/1.5), int(screen.height()/1.5))
        return partial_screen

    def play(self):
        if self.mediaPlayer.state() == QMediaPlayer.PlayingState:
            self.mediaPlayer.pause()
        else:
            self.mediaPlayer.play()

    def getButtonPosition(self):
        screen_dim = self.getScreenSize()
        width, height = screen_dim
        button_position = (int(width-(width/8)), int(height/20))
        return button_position

    def resizeByScreenSize(self):
        screen_dim = self.getScreenSize()
        self.resize(screen_dim[0], screen_dim[1])

    def segment(self, frame):
        sam = sam_model_registry["vit_h"](checkpoint="./sam_vit_h_4b8939.pth")
        mask_generator = SamAutomaticMaskGenerator(sam)
        masks = mask_generator.generate("")
        return masks # frame_segmented    

    def segment_framebyframe(self):
        from segment_anything import SamAutomaticMaskGenerator, sam_model_registry


    def inference_SA(self): 
        # TODO:  model inference

        # try:
            # segment_framebyframe()
            # pass
        # except: # Inference Error
            # raise RuntimeError("Model Inference Problem")
        # raise RuntimeError("Model Inference Not Written")
        results = SegManualMaskPredictor().video_predict(
            source=self.filename,
            model_type="vit_l", # vit_l, vit_h, vit_b
            input_point=[(50, 50), (100, 100)],
            input_label=[0, 1],
            input_box=None,
            multimask_output=False,
            random_color=False,
            output_path="Segmented.mp4",
        )
        print(results)
        seg_path = pathlib.Path(os.getcwd()) / results    
        seg_qurl = QUrl.fromLocalFile(str(seg_path))
        seg_media = QMediaContent(seg_qurl)
        return seg_media

    def segment_paint_save(self):
        # if "Segmented.mp4" in os.listdir(os.getcwd()):
        #     seg_path = pathlib.Path(os.getcwd()) / "Segmented.mp4"   
        #     seg_qurl = QUrl.fromLocalFile(str(seg_path))
        #     seg_media = QMediaContent(seg_qurl)
        #     return seg_media
        segmented = self.inference_SA() 
        # do we need to paint? can we call that as a parameter, i.e. segment with border size X
        # seg_painted = paint(segmented) ???
        return segmented

    def pause_and_load_media(self, segmented=False):
        if not segmented:
            self.mediaPlayer.pause()
            self.mediaPlayer.setMedia(self.media)
            self.mediaPlayer.play()
        else:
            self.mediaPlayer.pause()
            seg_painted = self.segment_paint_save()
            self.mediaPlayer.setMedia(seg_painted)
            self.mediaPlayer.play()

    def onClick(self):
        if self.button.isChecked():
            # segment_and_paint(self.grabber)
            if self.media != "":
                self.pause_and_load_media(True)
            self.button.setStyleSheet("background-color : green") # change color
        else:
            # unpaint(self.grabber)
            if self.media != "":
                self.pause_and_load_media()
            self.button.setStyleSheet("background-color : red") # unchange color

    def dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.accept()
        else:
            event.ignore()

    def dropEvent(self, event):
        files = [u.toLocalFile() for u in event.mimeData().urls()]
        if files != []:
            self.filename = files[0]
            local = QUrl.fromLocalFile(files[0])
            self.media = QMediaContent(local)
            self.playButton.setEnabled(True)
            self.mediaPlayer.setMedia(self.media)
            self.play()
            # self.show()
            # print(files[0])
            self.statusBar.showMessage(pathlib.Path(files[0]).name)
        else:
            print("Error: not a valid file")

    def process_frame(self, image):
        # Save image here
        print(image)
        # image.save('c:/temp/{}.jpg'.format(str(uuid.uuid4())))

    def mediaStateChanged(self, state):
        if self.mediaPlayer.state() == QMediaPlayer.PlayingState:
            self.playButton.setIcon(
                    self.style().standardIcon(QStyle.SP_MediaPause))
        else:
            self.playButton.setIcon(
                    self.style().standardIcon(QStyle.SP_MediaPlay))

    def positionChanged(self, position):
        self.positionSlider.setValue(position)

    def durationChanged(self, duration):
        self.positionSlider.setRange(0, duration)

    def setPosition(self, position):
        self.mediaPlayer.setPosition(position)

    def handleError(self):
        self.playButton.setEnabled(False)
        self.statusBar.showMessage("Error: " + self.mediaPlayer.errorString())



if __name__ == '__main__':
    def except_hook(cls, exception, traceback):
        sys.__excepthook__(cls, exception, traceback)


    if hasattr(QtCore.Qt, 'AA_EnableHighDpiScaling'):
        PyQt5.QtWidgets.QApplication.setAttribute(QtCore.Qt.AA_EnableHighDpiScaling, True)

    if hasattr(QtCore.Qt, 'AA_UseHighDpiPixmaps'):
        PyQt5.QtWidgets.QApplication.setAttribute(QtCore.Qt.AA_UseHighDpiPixmaps, True)

    # app = App(sys.argv)
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(True)

    ui = MainWidget()
    ui.show()
    sys.excepthook = except_hook
    sys.exit(app.exec_())
