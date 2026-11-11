Pod::Spec.new do |s|
  s.name           = 'DrosspotShare'
  s.version        = '1.0.0'
  s.summary        = 'Receipts shared to a teacher from the phone share sheet'
  s.description    = 'Receipts shared to a teacher from the phone share sheet'
  s.license        = 'UNLICENSED'
  s.author         = 'Dros Spot'
  s.homepage       = 'https://drosspot.app'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
