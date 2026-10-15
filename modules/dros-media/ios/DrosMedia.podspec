# Local Expo module (modules/dros-media), autolinked from ./modules — see DrosMediaModule.swift.
Pod::Spec.new do |s|
  s.name           = 'DrosMedia'
  s.version        = '1.0.0'
  s.summary        = 'DrosSpot: on-device video trim + compress, and the screen-capture state.'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'DrosSpot'
  s.homepage       = 'https://drosspot.app'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://drosspot.app' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'CoreMedia', 'UIKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
